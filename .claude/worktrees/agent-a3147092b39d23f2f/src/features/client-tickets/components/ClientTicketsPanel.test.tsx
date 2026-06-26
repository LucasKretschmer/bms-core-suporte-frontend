/**
 * Testes de ClientTicketsPanel — os 3 estados de UI (loading/erro/vazio) e render
 * de itens. Componente reutilizado tanto na página dedicada quanto no drawer inline
 * de Consumo de Planos (#11).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import { ClientTicketsPanel } from './ClientTicketsPanel'
import { useClientTickets } from '../hooks/useClientTickets'
import { useClientKpis } from '../hooks/useClientKpis'
import type { ClientTicketItemDto } from '../types/clientTickets'

vi.mock('../hooks/useClientTickets')
vi.mock('../hooks/useClientKpis')

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
    filters: { search: '', status: [] },
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
    render(<ClientTicketsPanel clientId={1} />)
    expect(screen.queryByText(/Nenhum ticket encontrado/i)).not.toBeInTheDocument()
    // Sem tabela durante loading
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('mostra ErrorState em erro', () => {
    mockedTickets.mockReturnValue(ticketsState({ isError: true }))
    render(<ClientTicketsPanel clientId={1} />)
    expect(screen.getByText(/tentar novamente/i)).toBeInTheDocument()
  })

  it('mostra EmptyState quando não há tickets', () => {
    mockedTickets.mockReturnValue(
      ticketsState({
        data: { items: [], totalCount: 0, page: 1, pageSize: 25, totalPages: 0 },
      }),
    )
    render(<ClientTicketsPanel clientId={1} />)
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
    render(<ClientTicketsPanel clientId={1} />)
    expect(screen.getByText('Erro no login')).toBeInTheDocument()
    expect(screen.getByText('#555')).toBeInTheDocument()
  })
})
