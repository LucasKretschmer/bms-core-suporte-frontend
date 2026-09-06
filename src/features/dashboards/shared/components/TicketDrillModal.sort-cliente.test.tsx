/**
 * 123/D1 — ordenação por CLIENTE nas tabelas de drill da família ticket.
 *
 * Este arquivo prova EFEITO, não forma: a asserção não é "existe `sortKey: 'cliente'`
 * no arquivo de colunas" (isso é piso, coberto em `ticketDrillColumns.test.ts`), e sim
 * que clicar no cabeçalho "Cliente" faz sair uma requisição HTTP real, serializada pela
 * instância `api` (mesmo `paramsSerializer` de produção), com `sortBy=cliente` na query
 * string — o nome de parâmetro que `MetricsController.GetMetricRows` liga
 * (`[FromQuery] string? sortBy`), cujo valor cai no case `"cliente"` da whitelist de
 * `MetricsQueryRepository.GetTicketRowsAsync`.
 *
 * A rede é interceptada no ADAPTER do axios (não em `getMetricRows`), para que a
 * serialização de query seja a de verdade. O caminho exercitado é o real:
 * useTicketDrill → useMetricDrill (queryKey + TanStack Query) → metricsService → axios.
 *
 * O que faz cada assert ficar vermelho:
 * - remover `sortable` OU `sortKey` de `colCliente` → a DataTable não desenha o
 *   `<button>` (`canSort = sortable && sortKey`) → `getByRole('button', {name})` falha;
 * - trocar o `sortKey` (ex.: 'clienteNome') → a query sai com o valor errado e o assert
 *   de `sortBy=cliente` falha (é exatamente o defeito que o backend ignoraria em
 *   silêncio, caindo no default `hscriadoem desc`);
 * - remover `sortBy`/`sortDirection` da queryKey de `useMetricDrill` → o clique não
 *   refetcha (staleTime de 2 min) e a contagem de requisições não cresce.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { AxiosAdapter } from 'axios'

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
}))

import { api } from '../../../../services/api'
import { ToastProvider } from '../../../../components/ui/Toast'
import { TicketDrillModal } from './TicketDrillModal'
import { useTicketDrill } from '../hooks/useTicketDrill'
import { TICKET_DRILL_METRICS } from '../utils/ticketDrillColumns'
import type { PaginatedResponse } from '../../../../types/api'
import type { DrillSpec, MetricsBaseParams, TicketRowDto } from '../types/metrics'

const ROW: TicketRowDto = {
  ticketId: 77,
  hubspotTicketId: '12345',
  assunto: 'Falha no login',
  clienteNome: 'ACME',
  equipe: 'Suporte N1',
  ownerNome: 'Fulano',
  status: 'Em andamento',
  hsCriadoEm: '2026-06-10',
  fechadoEm: null,
  reabertoEm: null,
  frHoras: null,
  frHorasUteis: null,
  frSla: null,
  resHoras: null,
  resHorasUteis: null,
  csat: null,
  isOneTouch: null,
  hubspotUrl: null,
}

const PAGE: PaginatedResponse<TicketRowDto> = {
  items: [ROW],
  totalCount: 1,
  page: 1,
  pageSize: 25,
  totalPages: 1,
}

const BASE: MetricsBaseParams = {
  scope: 'management:suporte',
  from: '2026-06-01',
  to: '2026-06-26',
}

/** Query strings de TODAS as requisições que saíram pela instância `api`. */
let queries: string[] = []
let originalAdapter: typeof api.defaults.adapter

/** Extrai só a query string, serializada pelo pipeline real do axios (`getUri`). */
function queryOf(url: string | undefined, params: unknown): string {
  const uri = api.getUri({ url, params: params as Record<string, unknown> })
  const i = uri.indexOf('?')
  return i === -1 ? '' : uri.slice(i + 1)
}

/**
 * Lê um parâmetro da n-ésima requisição pelo VALOR EXATO (`URLSearchParams`), nunca por
 * substring da query. Motivo medido em mutação dirigida: `expect(q).toContain('sortBy=cliente')`
 * fica VERDE com o mutante `sortKey: 'clienteNome'` — que é justamente o defeito silencioso
 * (chave fora da whitelist → o backend ignora e devolve a ordem default, sem erro).
 */
function param(i: number, name: string): string | null {
  return new URLSearchParams(queries[i]).get(name)
}

function Host({ spec }: { spec: DrillSpec }) {
  const drill = useTicketDrill(spec, BASE)
  return (
    <TicketDrillModal
      activeDrill={spec}
      onClose={() => {}}
      drill={drill}
      baseParams={BASE}
    />
  )
}

function renderHost(spec: DrillSpec) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <Host spec={spec} />
      </ToastProvider>
    </QueryClientProvider>,
  )
}

describe('123/D1 — cabeçalho "Cliente" ordena de servidor (wire real)', () => {
  beforeEach(() => {
    queries = []
    originalAdapter = api.defaults.adapter
    const adapter: AxiosAdapter = async (config) => {
      queries.push(queryOf(config.url, config.params))
      return {
        data: PAGE,
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      }
    }
    api.defaults.adapter = adapter
  })

  afterEach(() => {
    api.defaults.adapter = originalAdapter
  })

  it('a primeira carga NÃO manda sortBy (controle: o parâmetro não estava lá antes do clique)', async () => {
    renderHost({ metric: 'tickets-backlog', title: 'Backlog' })
    await waitFor(() => expect(queries.length).toBe(1))
    expect(param(0, 'metric')).toBe('tickets-backlog')
    expect(param(0, 'sortBy')).toBeNull()
    // `sortDirection` viaja sempre (o estado nasce 'desc'); sem `sortBy` o backend usa a
    // ordenação default (`hscriadoem`). É a AUSÊNCIA de `sortBy` que caracteriza o antes.
    expect(param(0, 'sortDirection')).toBe('desc')
  })

  it('clicar em "Cliente" dispara nova requisição com sortBy=cliente&sortDirection=desc', async () => {
    const user = userEvent.setup()
    renderHost({ metric: 'tickets-backlog', title: 'Backlog' })
    await waitFor(() => expect(queries.length).toBe(1))

    await user.click(screen.getByRole('button', { name: 'Ordenar por Cliente' }))

    // Requisição NOVA (não servida do cache) — prova que a queryKey inclui a ordenação.
    await waitFor(() => expect(queries.length).toBe(2))
    expect(param(1, 'sortBy')).toBe('cliente')
    expect(param(1, 'sortDirection')).toBe('desc')
    // O metric e os filtros da tela continuam os mesmos (consistência número↔linhas).
    expect(param(1, 'metric')).toBe('tickets-backlog')
    expect(param(1, 'scope')).toBe('management:suporte')
    expect(param(1, 'page')).toBe('1')
  })

  it('segundo clique inverte para asc e refetcha (toggle chega ao servidor)', async () => {
    const user = userEvent.setup()
    renderHost({ metric: 'tickets-backlog', title: 'Backlog' })
    await waitFor(() => expect(queries.length).toBe(1))

    // NOTA: reconsultar o botão a cada clique — a re-renderização da tabela após o
    // refetch substitui o nó do cabeçalho, e clicar numa referência velha não dispara
    // nada (o teste ficaria vermelho por motivo errado).
    await user.click(screen.getByRole('button', { name: 'Ordenar por Cliente' }))
    await waitFor(() => expect(queries.length).toBe(2))
    await user.click(screen.getByRole('button', { name: 'Ordenar por Cliente' }))
    await waitFor(() => expect(queries.length).toBe(3))

    expect(param(2, 'sortBy')).toBe('cliente')
    expect(param(2, 'sortDirection')).toBe('asc')
  })

  it('o cabeçalho é acionável por teclado e reflete aria-sort=descending', async () => {
    const user = userEvent.setup()
    renderHost({ metric: 'tickets-backlog', title: 'Backlog' })
    await waitFor(() => expect(queries.length).toBe(1))

    const header = screen.getByRole('button', { name: 'Ordenar por Cliente' })
    const cell = screen.getByRole('columnheader', { name: /Cliente/ })
    expect(cell).toHaveAttribute('aria-sort', 'none')

    header.focus()
    expect(header).toHaveFocus()
    await user.keyboard('{Enter}')

    await waitFor(() => expect(queries.length).toBe(2))
    expect(param(1, 'sortBy')).toBe('cliente')
    await waitFor(() =>
      expect(screen.getByRole('columnheader', { name: /Cliente/ })).toHaveAttribute(
        'aria-sort',
        'descending',
      ),
    )
  })

  it('vale para TODA métrica da família ticket (universo derivado em runtime)', async () => {
    const user = userEvent.setup()
    for (const metric of TICKET_DRILL_METRICS) {
      queries = []
      const { unmount } = renderHost({ metric, title: `Drill ${metric}` })
      await waitFor(() => expect(queries.length).toBe(1))

      await user.click(screen.getByRole('button', { name: 'Ordenar por Cliente' }))

      await waitFor(() => expect(queries.length).toBe(2))
      expect(param(1, 'sortBy'), `metric ${metric}`).toBe('cliente')
      expect(param(1, 'metric'), `metric ${metric}`).toBe(metric)
      unmount()
    }
  })
})
