/**
 * Testes para o hook useAppointments (U4 — Apontamentos por Ticket).
 *
 * Verifica:
 * - scope default por papel (#9): Coordenador+ → 'all'; Atendente → 'mine'
 * - status é array (filter de múltiplos valores)
 * - filtros são passados corretamente ao service
 * - ao mudar filtro, página volta para 1
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, act } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { format, startOfMonth } from 'date-fns'
import { useAppointments, defaultAppointmentsPeriod } from './useAppointments'
import { usePermissions } from '../../../../hooks/usePermissions'
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

// Mock de permissões — o scope default depende do papel.
vi.mock('../../../../hooks/usePermissions')
const mockedPermissions = vi.mocked(usePermissions)

function setRole(isCoordenadorOuAcima: boolean) {
  mockedPermissions.mockReturnValue({
    role: isCoordenadorOuAcima ? 'COORDENADOR' : 'ATENDENTE',
    isCoordenadorOuAcima,
    isGerentePlus: false,
    isAtendente: !isCoordenadorOuAcima,
    isAuthenticated: true,
  })
}

beforeEach(() => {
  // Default da maioria dos casos: Atendente (scope 'mine').
  setRole(false)
})

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
  it('Atendente inicia com scope "mine"', () => {
    setRole(false)
    const { result } = renderHook(() => useAppointments(), {
      wrapper: createWrapper(),
    })
    expect(result.current.filters.scope).toBe('mine')
  })

  it('Coordenador+ inicia com scope "all" (#9)', () => {
    setRole(true)
    const { result } = renderHook(() => useAppointments(), {
      wrapper: createWrapper(),
    })
    expect(result.current.filters.scope).toBe('all')
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

  it('período default = mês atual: from = 1º dia do mês, to = hoje', () => {
    const today = new Date()
    const expectedFrom = format(startOfMonth(today), 'yyyy-MM-dd')
    const expectedTo = format(today, 'yyyy-MM-dd')

    const { result } = renderHook(() => useAppointments(), {
      wrapper: createWrapper(),
    })
    expect(result.current.filters.from).toBe(expectedFrom)
    expect(result.current.filters.to).toBe(expectedTo)
  })

  it('período é clearable (usuário pode limpar from/to para null)', () => {
    const { result } = renderHook(() => useAppointments(), {
      wrapper: createWrapper(),
    })

    act(() => result.current.setFilters({ from: null, to: null }))
    expect(result.current.filters.from).toBeNull()
    expect(result.current.filters.to).toBeNull()
  })

  it('teamId inicia como array vazio e aceita múltiplos IDs', () => {
    const { result } = renderHook(() => useAppointments(), {
      wrapper: createWrapper(),
    })
    expect(result.current.filters.teamId).toEqual([])

    act(() => result.current.setFilters({ teamId: [1, 2] }))
    expect(result.current.filters.teamId).toEqual([1, 2])
  })

  it('ao mudar filtro de equipe, reseta para página 1', () => {
    const { result } = renderHook(() => useAppointments(), {
      wrapper: createWrapper(),
    })

    act(() => result.current.setPage(4))
    act(() => result.current.setFilters({ teamId: [3] }))
    expect(result.current.page).toBe(1)
  })
})

describe('defaultAppointmentsPeriod', () => {
  it('retorna 1º dia do mês como from e a data de referência como to', () => {
    const ref = new Date(2026, 5, 30) // 30/06/2026
    const period = defaultAppointmentsPeriod(ref)
    expect(period.from).toBe('2026-06-01')
    expect(period.to).toBe('2026-06-30')
  })
})
