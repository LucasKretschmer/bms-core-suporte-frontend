/**
 * WEB-1 / demanda 121 (P4 · causa C1) — os KPIs do topo do painel seguem o MESMO
 * período da tabela de chamados.
 *
 * Este arquivo NÃO mocka `useClientTickets`/`useClientKpis`: usa os hooks reais para
 * provar que KPI e tabela leem o período da MESMA fonte (o `filters` de
 * `useServerTable`, escrito pelo `PeriodFilter`). Só a camada de serviço é fake.
 *
 * O fake discrimina por período e devolve QUANTIDADES DIFERENTES em junho e julho
 * (rules/tests.md § "Cardinalidade simétrica não discrimina"): as asserções são sobre
 * os números renderizados, com literais escritos à mão — não sobre "os params foram
 * enviados".
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactElement, ReactNode } from 'react'
import { ClientTicketsPanel } from './ClientTicketsPanel'
import { ToastProvider } from '../../../components/ui/Toast'
import {
  getClientKpis,
  listClientTickets,
  type ClientKpisPeriod,
} from '../services/clientTicketsService'
import type { PlanConsumptionItemDto } from '../../reports/shared/types/reports'
import type { ClientTicketItemDto } from '../types/clientTickets'

vi.mock('../services/clientTicketsService', () => ({
  getClientKpis: vi.fn(),
  listClientTickets: vi.fn(),
  listTicketOwners: vi.fn().mockResolvedValue([]),
}))
vi.mock('../../reports/shared/services/reportsService', () => ({
  getTicketStatuses: vi.fn().mockResolvedValue([]),
  listTeams: vi.fn().mockResolvedValue([]),
}))

const mockedKpis = vi.mocked(getClientKpis)
const mockedTickets = vi.mocked(listClientTickets)

// ── Fake de backend, discriminando por período ────────────────────────────────

const JUNHO = { from: '2026-06-01', to: '2026-06-30' } as const
const JULHO = { from: '2026-07-01', to: '2026-07-31' } as const

function chave(period: { from?: string | null; to?: string | null }): string {
  return `${period.from ?? ''}|${period.to ?? ''}`
}

function kpiRow(partial: Partial<PlanConsumptionItemDto>): PlanConsumptionItemDto {
  return {
    clientId: 1,
    cnpj: '00.000.000/0001-00',
    nomeFantasia: 'Acme',
    razaoSocial: 'Acme LTDA',
    nomePlano: 'Plano X',
    qtdePlanoHoras: 10,
    horasUsadas: 0,
    horasRestantes: 10,
    horasAdicionais: 0,
    percentualPlano: 0,
    horasFaturaveis: 0,
    horasAnalise: 0,
    ...partial,
  }
}

function ticket(id: number, assunto: string): ClientTicketItemDto {
  return {
    ticketId: id,
    hubspotTicketId: String(1000 + id),
    assunto,
    clienteNome: 'Acme',
    equipe: 'Suporte',
    ownerNome: 'Ana',
    status: 'Aberto',
    // 1500s → "0h 25m": nunca colide com os números dos KPIs nas asserções.
    totalSeconds: 1500,
    apontamentosCount: 1,
    hubspotUrl: null,
    totalSecondsAllTime: 1500,
    apontamentosCountAllTime: 1,
    statusNome: null,
    statusCategoria: null,
    categoriasTimer: [],
  }
}

/**
 * Junho: 4h usadas / 6h restantes / 40% · 2 chamados.
 * Julho: 9h usadas / 1h restante / 90% · 3 chamados.
 * Quantidades DIFERENTES nos dois períodos — com números iguais o teste passaria
 * até com o filtro invertido.
 */
const KPIS_POR_PERIODO: Record<string, PlanConsumptionItemDto> = {
  [chave(JUNHO)]: kpiRow({ horasUsadas: 4, horasRestantes: 6, percentualPlano: 40 }),
  [chave(JULHO)]: kpiRow({ horasUsadas: 9, horasRestantes: 1, percentualPlano: 90 }),
}

const TICKETS_POR_PERIODO: Record<string, ClientTicketItemDto[]> = {
  [chave(JUNHO)]: [ticket(1, 'Chamado de junho A'), ticket(2, 'Chamado de junho B')],
  [chave(JULHO)]: [
    ticket(3, 'Chamado de julho A'),
    ticket(4, 'Chamado de julho B'),
    ticket(5, 'Chamado de julho C'),
  ],
}

function renderPanel(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>{children}</ToastProvider>
    </QueryClientProvider>
  )
  return render(ui, { wrapper })
}

/** Escopo dos KPIs do topo — evita casar com números iguais nas células da tabela. */
function kpis() {
  return within(screen.getByLabelText('Resumo do plano do cliente'))
}

/** Último período com que o serviço de KPIs foi chamado. */
function ultimoPeriodoKpis(): ClientKpisPeriod | undefined {
  return mockedKpis.mock.calls.at(-1)?.[1]
}

/** Último período com que a tabela de chamados foi chamada. */
function ultimoPeriodoTabela(): { from?: string; to?: string } | undefined {
  const params = mockedTickets.mock.calls.at(-1)?.[0]
  return params && { from: params.from, to: params.to }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockedKpis.mockImplementation((_clientId: number, period: ClientKpisPeriod) =>
    Promise.resolve(KPIS_POR_PERIODO[chave(period)] ?? null),
  )
  mockedTickets.mockImplementation((params) => {
    const items = TICKETS_POR_PERIODO[chave(params)] ?? []
    return Promise.resolve({
      items,
      totalCount: items.length,
      page: 1,
      pageSize: 25,
      totalPages: items.length > 0 ? 1 : 0,
    })
  })
})

describe('ClientTicketsPanel — KPIs seguem o período (121/C1)', () => {
  it('na abertura, KPIs e tabela leem o MESMO período semeado', async () => {
    renderPanel(
      <ClientTicketsPanel clientId={1} initialFrom={JUNHO.from} initialTo={JUNHO.to} />,
    )

    // Números de JUNHO (literais escritos à mão).
    expect(await kpis().findByText('4h 0m')).toBeInTheDocument()
    expect(kpis().getByText('6h 0m')).toBeInTheDocument()
    expect(kpis().getByText('40,0%')).toBeInTheDocument()
    // A tabela do mesmo período (2 chamados).
    expect(await screen.findByText('Chamado de junho A')).toBeInTheDocument()
    expect(screen.getByText('Chamado de junho B')).toBeInTheDocument()

    // Mesma janela nos dois consumidores.
    expect(ultimoPeriodoKpis()).toEqual({ from: JUNHO.from, to: JUNHO.to })
    expect(ultimoPeriodoTabela()).toEqual({ from: JUNHO.from, to: JUNHO.to })
  })

  it('mudar o período com o painel aberto refaz a query dos KPIs (não serve o cache do período anterior)', async () => {
    renderPanel(
      <ClientTicketsPanel clientId={1} initialFrom={JUNHO.from} initialTo={JUNHO.to} />,
    )
    expect(await kpis().findByText('4h 0m')).toBeInTheDocument()

    // Usuário troca o período DEPOIS de abrir o painel.
    fireEvent.change(screen.getByLabelText('Até'), { target: { value: JULHO.to } })
    fireEvent.change(screen.getByLabelText('De'), { target: { value: JULHO.from } })

    // Números de JULHO — e os de junho desaparecem (nada de cache velho).
    expect(await kpis().findByText('9h 0m')).toBeInTheDocument()
    expect(kpis().getByText('1h 0m')).toBeInTheDocument()
    expect(kpis().getByText('90,0%')).toBeInTheDocument()
    expect(kpis().queryByText('4h 0m')).not.toBeInTheDocument()
    expect(kpis().queryByText('40,0%')).not.toBeInTheDocument()

    // Tabela do mesmo período (3 chamados) — divergência dentro da tela seria bug.
    expect(await screen.findByText('Chamado de julho C')).toBeInTheDocument()
    expect(screen.queryByText('Chamado de junho A')).not.toBeInTheDocument()

    await waitFor(() => {
      expect(ultimoPeriodoKpis()).toEqual({ from: JULHO.from, to: JULHO.to })
    })
    expect(ultimoPeriodoTabela()).toEqual({ from: JULHO.from, to: JULHO.to })
  })

  it('sem período selecionado, envia from/to nulos aos KPIs (ramo explícito: backend aplica o default)', async () => {
    renderPanel(<ClientTicketsPanel clientId={1} />)
    await waitFor(() => {
      expect(ultimoPeriodoKpis()).toEqual({ from: null, to: null })
    })
    expect(ultimoPeriodoTabela()).toEqual({ from: undefined, to: undefined })
  })

  it('período sem linha de consumo → KPIs vazios ("—" + aviso), sem quebrar a tabela', async () => {
    renderPanel(
      <ClientTicketsPanel clientId={1} initialFrom="2026-08-01" initialTo="2026-08-31" />,
    )
    // O aviso só aparece depois de carregar (não durante o skeleton).
    expect(await kpis().findByText('Cliente sem plano no período')).toBeInTheDocument()
    expect(kpis().getAllByText('—').length).toBeGreaterThan(0)
    expect(kpis().queryByText('4h 0m')).not.toBeInTheDocument()
  })

  it('erro nos KPIs → ErrorState com retry, sem derrubar a tabela de chamados', async () => {
    mockedKpis.mockRejectedValue(new Error('falha'))
    renderPanel(
      <ClientTicketsPanel clientId={1} initialFrom={JUNHO.from} initialTo={JUNHO.to} />,
    )

    expect(await screen.findByText(/resumo do plano/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /tentar novamente/i })).toBeInTheDocument()
    // A tabela continua funcionando (queries independentes).
    expect(await screen.findByText('Chamado de junho A')).toBeInTheDocument()
  })

  it('enquanto os KPIs do período carregam, mostra skeleton (sem número velho na tela)', async () => {
    mockedKpis.mockReturnValue(new Promise<PlanConsumptionItemDto | null>(() => {}))
    renderPanel(
      <ClientTicketsPanel clientId={1} initialFrom={JUNHO.from} initialTo={JUNHO.to} />,
    )

    await waitFor(() => {
      expect(kpis().getAllByLabelText('Carregando…').length).toBeGreaterThan(0)
    })
    expect(kpis().queryByText('4h 0m')).not.toBeInTheDocument()
    // Durante o loading o aviso de "sem plano" NÃO aparece (loading ≠ vazio).
    expect(kpis().queryByText('Cliente sem plano no período')).not.toBeInTheDocument()
  })
})
