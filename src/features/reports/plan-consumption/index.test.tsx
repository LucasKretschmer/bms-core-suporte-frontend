/**
 * Testes da página Consumo de Planos (index.tsx) — foco na demanda 070:
 *  - o drawer (Modal) dos chamados do cliente usa 90% da largura (max-w-[90vw]/w-[90vw]);
 *  - clicar num chamado navega para /relatorios/tickets/$ticketId (por id interno),
 *    com from='consumo-planos'.
 *
 * O ClientTicketsPanel é stub-ado para expor um botão que dispara onTicketClick —
 * isolando a asserção no wiring da página (navegação + props do Modal). O
 * comportamento interno do painel/tabela é coberto por ClientTicketsPanel.test.tsx.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { PlanConsumptionItemDto } from '../shared/types/reports'
import type { ClientTicketItemDto } from '../../client-tickets/types/clientTickets'

// ── Mocks ─────────────────────────────────────────────────────────────────────

const navigateMock = vi.fn()
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigateMock,
}))

vi.mock('./hooks/usePlanConsumption', () => ({
  usePlanConsumption: vi.fn(),
}))

// Stub do painel: expõe um botão que aciona onTicketClick com uma linha fixa.
const stubTicket: ClientTicketItemDto = {
  ticketId: 321,
  hubspotTicketId: '888',
  assunto: 'Assunto',
  clienteNome: 'Acme',
  equipe: 'Suporte',
  ownerNome: 'Ana',
  status: 'Aberto',
  totalSeconds: 60,
  apontamentosCount: 1,
  hubspotUrl: null,
}
vi.mock('../../client-tickets/components/ClientTicketsPanel', () => ({
  ClientTicketsPanel: ({
    onTicketClick,
  }: {
    onTicketClick?: (row: ClientTicketItemDto) => void
  }) => (
    <button type="button" onClick={() => onTicketClick?.(stubTicket)}>
      abrir-ticket
    </button>
  ),
}))

import PlanConsumptionPage from './index'
import { usePlanConsumption } from './hooks/usePlanConsumption'

const mockedUsePlanConsumption = vi.mocked(usePlanConsumption)

const clientRow: PlanConsumptionItemDto = {
  clientId: 9,
  cnpj: '00.000.000/0001-00',
  nomeFantasia: 'Acme',
  razaoSocial: 'Acme LTDA',
  nomePlano: 'Plano X',
  qtdePlanoHoras: 10,
  horasUsadas: 5,
  horasRestantes: 5,
  horasAdicionais: 0,
  percentualPlano: 50,
  horasFaturaveis: 0,
  horasAnalise: 0,
} as unknown as PlanConsumptionItemDto

beforeEach(() => {
  vi.clearAllMocks()
  mockedUsePlanConsumption.mockReturnValue({
    data: {
      items: [clientRow],
      totalCount: 1,
      page: 1,
      pageSize: 25,
      totalPages: 1,
    },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
    sortBy: null,
    sortDirection: 'desc',
    filters: { search: '', planId: null, from: null, to: null },
    page: 1,
    pageSize: 25,
    setPage: vi.fn(),
    setPageSize: vi.fn(),
    setSort: vi.fn(),
    setFilters: vi.fn(),
    resetFilters: vi.fn(),
  } as unknown as ReturnType<typeof usePlanConsumption>)
})

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <PlanConsumptionPage />
    </QueryClientProvider>,
  )
}

function openDrawer() {
  // Clica na linha da tabela (nome fantasia) para abrir o drawer inline.
  fireEvent.click(screen.getByText('Acme'))
}

describe('PlanConsumptionPage — drawer de chamados (070)', () => {
  it('o Modal do drawer usa 90% da largura (max-w-[90vw] w-[90vw])', () => {
    renderPage()
    openDrawer()
    const dialog = screen.getByRole('dialog')
    const content = dialog.querySelector('.max-w-\\[90vw\\]')
    expect(content).not.toBeNull()
    expect(content).toHaveClass('w-[90vw]')
  })

  it('clicar no chamado navega para /relatorios/tickets/$ticketId com id interno e from=consumo-planos', () => {
    renderPage()
    openDrawer()
    fireEvent.click(screen.getByText('abrir-ticket'))
    expect(navigateMock).toHaveBeenCalledTimes(1)
    expect(navigateMock).toHaveBeenCalledWith({
      to: '/relatorios/tickets/$ticketId',
      params: { ticketId: '321' },
      search: { from: 'consumo-planos' },
    })
  })
})
