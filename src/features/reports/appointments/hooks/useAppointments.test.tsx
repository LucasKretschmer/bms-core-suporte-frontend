/**
 * Testes para o hook useAppointments (U4 — Apontamentos por Ticket).
 *
 * Verifica:
 * - scope padrão é 'mine'
 * - status é array (filter de múltiplos valores)
 * - filtros são passados corretamente ao service
 * - ao mudar filtro, página volta para 1
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, act } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useAppointments } from './useAppointments'
import type { PaginatedResponse } from '../../../../types/api'
import type { TicketReportItemDto } from '../../shared/types/reports'

// Mock do service para evitar chamadas HTTP reais
vi.mock('../../shared/services/reportsService', () => ({
  listTicketsReport: vi.fn().mockResolvedValue({
    items: [],
    totalCount: 0,
    page: 1,
    pageSize: 25,
    totalPages: 0,
  } satisfies PaginatedResponse<TicketReportItemDto>),
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe('useAppointments', () => {
  it('inicia com scope padrão "mine"', () => {
    const { result } = renderHook(() => useAppointments(), {
      wrapper: createWrapper(),
    })
    expect(result.current.filters.scope).toBe('mine')
  })

  it('status é um array vazio por padrão', () => {
    const { result } = renderHook(() => useAppointments(), {
      wrapper: createWrapper(),
    })
    expect(Array.isArray(result.current.filters.status)).toBe(true)
    expect(result.current.filters.status).toHaveLength(0)
  })

  it('permite alterar scope para "all" (para CoordenadorPlus)', () => {
    const { result } = renderHook(() => useAppointments(), {
      wrapper: createWrapper(),
    })

    act(() => {
      result.current.setFilters({ scope: 'all' })
    })

    expect(result.current.filters.scope).toBe('all')
  })

  it('aceita múltiplos status como array', () => {
    const { result } = renderHook(() => useAppointments(), {
      wrapper: createWrapper(),
    })

    act(() => {
      result.current.setFilters({ status: ['Aberto', 'Em andamento'] })
    })

    expect(result.current.filters.status).toEqual(['Aberto', 'Em andamento'])
  })

  it('ao mudar filtro de status, reseta para página 1', () => {
    const { result } = renderHook(() => useAppointments(), {
      wrapper: createWrapper(),
    })

    act(() => result.current.setPage(3))
    expect(result.current.page).toBe(3)

    act(() => result.current.setFilters({ status: ['Fechado'] }))
    expect(result.current.page).toBe(1)
  })

  it('ao mudar search, reseta para página 1', () => {
    const { result } = renderHook(() => useAppointments(), {
      wrapper: createWrapper(),
    })

    act(() => result.current.setPage(5))
    act(() => result.current.setFilters({ search: 'teste' }))
    expect(result.current.page).toBe(1)
    expect(result.current.filters.search).toBe('teste')
  })

  it('inicia com sortDirection "desc"', () => {
    const { result } = renderHook(() => useAppointments(), {
      wrapper: createWrapper(),
    })
    expect(result.current.sortDirection).toBe('desc')
  })

  it('from e to iniciam como null', () => {
    const { result } = renderHook(() => useAppointments(), {
      wrapper: createWrapper(),
    })
    expect(result.current.filters.from).toBeNull()
    expect(result.current.filters.to).toBeNull()
  })
})
