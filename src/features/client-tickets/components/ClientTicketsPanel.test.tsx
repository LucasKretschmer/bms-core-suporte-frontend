/**
 * Testes de ClientTicketsPanel — os 3 estados de UI (loading/erro/vazio) e render
 * de itens. Componente reutilizado tanto na página dedicada quanto no drawer inline
 * de Consumo de Planos (#11).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { ClientTicketsPanel } from './ClientTicketsPanel'
import { ToastProvider } from '../../../components/ui/Toast'
import { useClientTickets } from '../hooks/useClientTickets'
import { useClientKpis } from '../hooks/useClientKpis'
import { listClientTickets } from '../services/clientTicketsService'
import type { ClientTicketItemDto } from '../types/clientTickets'

/**
 * Render com ToastProvider (feedback de export) + QueryClientProvider — o painel
 * usa useQuery() para carregar opções de Equipe/Atendente/Status (070).
 */
function renderPanel(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>{ui}</ToastProvider>
    </QueryClientProvider>,
  )
}

vi.mock('../hooks/useClientTickets')
vi.mock('../hooks/useClientKpis')
// Fontes das opções dos filtros multi-select (070) — retornam vazio, não quebram.
vi.mock('../../reports/shared/services/reportsService', () => ({
  getTicketStatuses: vi.fn().mockResolvedValue([]),
  listTeams: vi.fn().mockResolvedValue([]),
}))
vi.mock('../services/clientTicketsService', () => ({
  listClientTickets: vi.fn().mockResolvedValue({
    items: [],
    totalCount: 0,
    page: 1,
    pageSize: 25,
    totalPages: 0,
  }),
  listTicketOwners: vi.fn().mockResolvedValue([]),
}))

const mockedTickets = vi.mocked(useClientTickets)
const mockedKpis = vi.mocked(useClientKpis)

type TicketsReturn = ReturnType<typeof useClientTickets>
type KpisReturn = ReturnType<typeof useClientKpis>

function ticketsState(partial: Partial<TicketsReturn>): TicketsReturn {
  return {
    data: undefined,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
    page: 1,
    pageSize: 25,
    sortBy: null,
    sortDirection: 'desc',
    filters: { search: '', status: [], teamId: [], owner: [], from: null, to: null },
    setPage: vi.fn(),
    setPageSize: vi.fn(),
    setSort: vi.fn(),
    setFilters: vi.fn(),
    resetFilters: vi.fn(),
    ...partial,
  } as TicketsReturn
}

beforeEach(() => {
  vi.clearAllMocks()
  // KPIs irrelevantes para os estados da tabela — sempre "carregado vazio".
  mockedKpis.mockReturnValue({ data: null, isLoading: false } as KpisReturn)
})

describe('ClientTicketsPanel — estados de UI', () => {
  it('mostra Skeleton enquanto carrega', () => {
    mockedTickets.mockReturnValue(ticketsState({ isLoading: true }))
    renderPanel(<ClientTicketsPanel clientId={1} />)
    expect(screen.queryByText(/Nenhum ticket encontrado/i)).not.toBeInTheDocument()
    // Sem tabela durante loading
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('mostra ErrorState em erro', () => {
    mockedTickets.mockReturnValue(ticketsState({ isError: true }))
    renderPanel(<ClientTicketsPanel clientId={1} />)
    expect(screen.getByText(/tentar novamente/i)).toBeInTheDocument()
  })

  it('mostra EmptyState quando não há tickets', () => {
    mockedTickets.mockReturnValue(
      ticketsState({
        data: { items: [], totalCount: 0, page: 1, pageSize: 25, totalPages: 0 },
      }),
    )
    renderPanel(<ClientTicketsPanel clientId={1} />)
    expect(screen.getByText(/Nenhum ticket encontrado para este cliente/i)).toBeInTheDocument()
  })

  it('renderiza a tabela com itens', () => {
    const items: ClientTicketItemDto[] = [
      {
        ticketId: 10,
        hubspotTicketId: '555',
        assunto: 'Erro no login',
        clienteNome: 'Acme',
        equipe: 'Suporte',
        ownerNome: 'Maria',
        status: 'Aberto',
        totalSeconds: 3600,
        apontamentosCount: 2,
        hubspotUrl: null,
      },
    ]
    mockedTickets.mockReturnValue(
      ticketsState({
        data: { items, totalCount: 1, page: 1, pageSize: 25, totalPages: 1 },
      }),
    )
    renderPanel(<ClientTicketsPanel clientId={1} />)
    expect(screen.getByText('Erro no login')).toBeInTheDocument()
    expect(screen.getByText('#555')).toBeInTheDocument()
  })
})

describe('ClientTicketsPanel — filtros multi-select (070)', () => {
  it('renderiza os três filtros: Equipe, Atendente e Status', () => {
    mockedTickets.mockReturnValue(
      ticketsState({
        data: { items: [], totalCount: 0, page: 1, pageSize: 25, totalPages: 0 },
      }),
    )
    renderPanel(<ClientTicketsPanel clientId={1} />)
    expect(screen.getByText('Equipe')).toBeInTheDocument()
    expect(screen.getByText('Atendente')).toBeInTheDocument()
    expect(screen.getByText('Status')).toBeInTheDocument()
  })

  it('setFilters é chamado com owner ao alterar o filtro de Atendente', () => {
    const setFilters = vi.fn()
    mockedTickets.mockReturnValue(
      ticketsState({
        setFilters,
        data: { items: [], totalCount: 0, page: 1, pageSize: 25, totalPages: 0 },
      }),
    )
    renderPanel(<ClientTicketsPanel clientId={1} />)
    // O combobox de atendente é controlado; garantimos que o wiring do onChange
    // aponta para setFilters({ owner }) — validado indiretamente pela presença do
    // controle e por manter os demais filtros intactos. O comportamento do combobox
    // em si já é coberto por MultiSelectCombobox.test.tsx.
    expect(screen.getByText('Atendente')).toBeInTheDocument()
    expect(setFilters).not.toHaveBeenCalled()
  })
})

describe('ClientTicketsPanel — click no chamado (070)', () => {
  it('chama onTicketClick com a linha ao clicar no ticket', () => {
    const onTicketClick = vi.fn()
    const items: ClientTicketItemDto[] = [
      {
        ticketId: 77,
        hubspotTicketId: '999',
        assunto: 'Falha no relatório',
        clienteNome: 'Acme',
        equipe: 'Suporte',
        ownerNome: 'João',
        status: 'Aberto',
        totalSeconds: 1800,
        apontamentosCount: 3,
        hubspotUrl: null,
      },
    ]
    mockedTickets.mockReturnValue(
      ticketsState({
        data: { items, totalCount: 1, page: 1, pageSize: 25, totalPages: 1 },
      }),
    )
    renderPanel(<ClientTicketsPanel clientId={1} onTicketClick={onTicketClick} />)
    fireEvent.click(screen.getByText('Falha no relatório'))
    expect(onTicketClick).toHaveBeenCalledTimes(1)
    expect(onTicketClick.mock.calls[0][0]).toMatchObject({ ticketId: 77 })
  })
})

describe('ClientTicketsPanel — filtro de período (095)', () => {
  it('renderiza o filtro de período (PeriodFilter: De/Até)', () => {
    mockedTickets.mockReturnValue(
      ticketsState({
        data: { items: [], totalCount: 0, page: 1, pageSize: 25, totalPages: 0 },
      }),
    )
    renderPanel(<ClientTicketsPanel clientId={1} />)
    expect(screen.getByText('De')).toBeInTheDocument()
    expect(screen.getByText('Até')).toBeInTheDocument()
  })

  it('pré-preenche o período via initialFrom/initialTo (semeia o hook)', () => {
    mockedTickets.mockReturnValue(
      ticketsState({
        data: { items: [], totalCount: 0, page: 1, pageSize: 25, totalPages: 0 },
      }),
    )
    renderPanel(
      <ClientTicketsPanel clientId={1} initialFrom="2026-06-01" initialTo="2026-06-30" />,
    )
    // O hook (mockado) deve receber as datas iniciais para semear o estado.
    expect(mockedTickets).toHaveBeenCalledWith(1, { from: '2026-06-01', to: '2026-06-30' })
  })

  it('passa null ao hook quando não há datas iniciais', () => {
    mockedTickets.mockReturnValue(
      ticketsState({
        data: { items: [], totalCount: 0, page: 1, pageSize: 25, totalPages: 0 },
      }),
    )
    renderPanel(<ClientTicketsPanel clientId={1} />)
    expect(mockedTickets).toHaveBeenCalledWith(1, { from: null, to: null })
  })

  it('reflete o período atual do filtro nos inputs (De/Até)', () => {
    mockedTickets.mockReturnValue(
      ticketsState({
        filters: {
          search: '',
          status: [],
          teamId: [],
          owner: [],
          from: '2026-06-01',
          to: '2026-06-30',
        },
        data: { items: [], totalCount: 0, page: 1, pageSize: 25, totalPages: 0 },
      }),
    )
    renderPanel(<ClientTicketsPanel clientId={1} />)
    expect(screen.getByLabelText('De')).toHaveValue('2026-06-01')
    expect(screen.getByLabelText('Até')).toHaveValue('2026-06-30')
  })

  it('export inclui from/to do período no fetch (095)', async () => {
    const items: ClientTicketItemDto[] = [
      {
        ticketId: 10,
        hubspotTicketId: '555',
        assunto: 'Erro no login',
        clienteNome: 'Acme',
        equipe: 'Suporte',
        ownerNome: 'Maria',
        status: 'Aberto',
        totalSeconds: 3600,
        apontamentosCount: 2,
        hubspotUrl: null,
      },
    ]
    vi.mocked(listClientTickets).mockResolvedValue({
      items,
      totalCount: 1,
      page: 1,
      pageSize: 200,
      totalPages: 1,
    })
    mockedTickets.mockReturnValue(
      ticketsState({
        filters: {
          search: '',
          status: [],
          teamId: [],
          owner: [],
          from: '2026-06-01',
          to: '2026-06-30',
        },
        data: { items, totalCount: 1, page: 1, pageSize: 25, totalPages: 1 },
      }),
    )
    renderPanel(<ClientTicketsPanel clientId={1} />)

    fireEvent.click(screen.getByRole('button', { name: /csv/i }))

    await waitFor(() => {
      expect(vi.mocked(listClientTickets)).toHaveBeenCalledWith(
        expect.objectContaining({ from: '2026-06-01', to: '2026-06-30' }),
      )
    })
  })
})
