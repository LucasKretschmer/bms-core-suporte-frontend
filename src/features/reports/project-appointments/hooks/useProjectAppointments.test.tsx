/**
 * Testes do hook useProjectAppointments (057 — Apontamentos por Projeto).
 *
 * Verifica:
 * - scope default por papel: Coordenador+ → 'all'; Atendente → 'mine'
 * - período default = mês atual (clearable)
 * - teamId e clientId como filtros; reset de página ao filtrar
 * - parâmetros repassados ao service
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, act, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { format, startOfMonth } from 'date-fns'
import {
  useProjectAppointments,
  defaultProjectAppointmentsPeriod,
} from './useProjectAppointments'
import { usePermissions } from '../../../../hooks/usePermissions'
import type { PaginatedResponse } from '../../../../types/api'
import type { ProjectAppointmentReportItemDto } from '../../shared/types/reports'

vi.mock('../../shared/services/reportsService', () => ({
  listProjectAppointments: vi.fn().mockResolvedValue({
    items: [],
    totalCount: 0,
    page: 1,
    pageSize: 25,
    totalPages: 0,
  } satisfies PaginatedResponse<ProjectAppointmentReportItemDto>),
}))

import { listProjectAppointments } from '../../shared/services/reportsService'
const mockedList = vi.mocked(listProjectAppointments)

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
  vi.clearAllMocks()
  setRole(false)
})

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe('useProjectAppointments', () => {
  it('Atendente inicia com scope "mine"', () => {
    setRole(false)
    const { result } = renderHook(() => useProjectAppointments(), { wrapper: createWrapper() })
    expect(result.current.filters.scope).toBe('mine')
  })

  it('Coordenador+ inicia com scope "all"', () => {
    setRole(true)
    const { result } = renderHook(() => useProjectAppointments(), { wrapper: createWrapper() })
    expect(result.current.filters.scope).toBe('all')
  })

  it('período default = mês atual: from = 1º dia do mês, to = hoje', () => {
    const today = new Date()
    const { result } = renderHook(() => useProjectAppointments(), { wrapper: createWrapper() })
    expect(result.current.filters.from).toBe(format(startOfMonth(today), 'yyyy-MM-dd'))
    expect(result.current.filters.to).toBe(format(today, 'yyyy-MM-dd'))
  })

  it('período é clearable (from/to → null)', () => {
    const { result } = renderHook(() => useProjectAppointments(), { wrapper: createWrapper() })
    act(() => result.current.setFilters({ from: null, to: null }))
    expect(result.current.filters.from).toBeNull()
    expect(result.current.filters.to).toBeNull()
  })

  it('teamId inicia vazio e aceita múltiplos IDs', () => {
    const { result } = renderHook(() => useProjectAppointments(), { wrapper: createWrapper() })
    expect(result.current.filters.teamId).toEqual([])
    act(() => result.current.setFilters({ teamId: [1, 2] }))
    expect(result.current.filters.teamId).toEqual([1, 2])
  })

  it('clientId inicia null e pode ser definido', () => {
    const { result } = renderHook(() => useProjectAppointments(), { wrapper: createWrapper() })
    expect(result.current.filters.clientId).toBeNull()
    act(() => result.current.setFilters({ clientId: '45' }))
    expect(result.current.filters.clientId).toBe('45')
  })

  it('ao mudar filtro de equipe, reseta para página 1', () => {
    const { result } = renderHook(() => useProjectAppointments(), { wrapper: createWrapper() })
    act(() => result.current.setPage(4))
    act(() => result.current.setFilters({ teamId: [3] }))
    expect(result.current.page).toBe(1)
  })

  it('inicia com sortDirection "desc"', () => {
    const { result } = renderHook(() => useProjectAppointments(), { wrapper: createWrapper() })
    expect(result.current.sortDirection).toBe('desc')
  })

  it('repassa scope/teamId/clientId/período ao service', async () => {
    const { result } = renderHook(() => useProjectAppointments(), { wrapper: createWrapper() })
    act(() => result.current.setFilters({ teamId: [7], clientId: '45' }))

    await waitFor(() => {
      expect(mockedList).toHaveBeenCalledWith(
        expect.objectContaining({ scope: 'mine', teamId: [7], clientId: '45' }),
      )
    })
  })
})

describe('defaultProjectAppointmentsPeriod', () => {
  it('retorna 1º dia do mês como from e a data de referência como to', () => {
    const ref = new Date(2026, 5, 30) // 30/06/2026
    const period = defaultProjectAppointmentsPeriod(ref)
    expect(period.from).toBe('2026-06-01')
    expect(period.to).toBe('2026-06-30')
  })
})
