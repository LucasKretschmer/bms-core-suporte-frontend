/**
 * 124/`P-7` — o cabeçalho "1º atendimento" **no DOM da tabela de drill**.
 *
 * `ticketDrillColumns.test.ts` prova a projeção (piso, e é ela que cobre o export, que não
 * tem tela). Este arquivo prova o **efeito**: o gestor que abre o drill de tempos lê "1º
 * atendimento", e não "1ª resposta" (`rules/tests.md` § o sujeito da frase decide o tipo
 * de teste).
 *
 * A rede é interceptada no adapter do axios — mesma convenção de
 * `TicketDrillModal.sort-cliente.test.tsx` — para que a tabela renderize com uma linha
 * real e os cabeçalhos existam de fato.
 *
 * O que faz estes asserts ficarem vermelhos: restaurar `header: '1ª resposta (úteis)'` (ou
 * os irmãos) em `ticketDrillColumns.ts` — a mutação `P7-COLUNA-DRILL`.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { AxiosAdapter } from 'axios'

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
}))

import { api } from '../../../../services/api'
import { ToastProvider } from '../../../../components/ui/Toast'
import { TicketDrillModal } from './TicketDrillModal'
import { useTicketDrill } from '../hooks/useTicketDrill'
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
  frHoras: 2,
  frHorasUteis: 1,
  frSla: 'MET',
  resHoras: 5,
  resHorasUteis: 3,
  csat: 4.5,
  isOneTouch: true,
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

let requisicoes = 0
let originalAdapter: typeof api.defaults.adapter

function Host({ spec }: { spec: DrillSpec }) {
  const drill = useTicketDrill(spec, BASE)
  return (
    <TicketDrillModal activeDrill={spec} onClose={() => {}} drill={drill} baseParams={BASE} />
  )
}

function renderHost(spec: DrillSpec) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <Host spec={spec} />
      </ToastProvider>
    </QueryClientProvider>,
  )
}

describe('TicketDrillModal — vocabulário "1º atendimento" nos cabeçalhos (124/P-7)', () => {
  beforeEach(() => {
    requisicoes = 0
    originalAdapter = api.defaults.adapter
    const adapter: AxiosAdapter = async (config) => {
      requisicoes += 1
      return { data: PAGE, status: 200, statusText: 'OK', headers: {}, config }
    }
    api.defaults.adapter = adapter
  })

  afterEach(() => {
    api.defaults.adapter = originalAdapter
  })

  it('o drill de tempos mostra "1º atendimento (corridas)" e "(úteis)"', async () => {
    renderHost({ metric: 'tickets-tempos', title: 'Tickets com tempos de atendimento' })
    await waitFor(() => expect(requisicoes).toBe(1))

    // Controle positivo: a tabela realmente renderizou (a linha está lá).
    expect(await screen.findByText('ACME')).toBeInTheDocument()

    expect(
      screen.getByRole('columnheader', { name: '1º atendimento (corridas)' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('columnheader', { name: '1º atendimento (úteis)' }),
    ).toBeInTheDocument()
    expect(document.body.textContent ?? '').not.toMatch(/1ª resposta/i)
  })

  it('o drill de SLA mostra "SLA 1º atendimento"', async () => {
    renderHost({ metric: 'tickets-sla', title: 'Atendidos no prazo (SLA)' })
    await waitFor(() => expect(requisicoes).toBe(1))

    expect(await screen.findByText('ACME')).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'SLA 1º atendimento' })).toBeInTheDocument()
    expect(document.body.textContent ?? '').not.toMatch(/1ª resposta/i)
  })
})
