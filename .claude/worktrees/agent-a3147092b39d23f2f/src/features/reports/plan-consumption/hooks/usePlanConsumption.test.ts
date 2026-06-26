import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, act } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { usePlanConsumption } from './usePlanConsumption'
import * as reportsService from '../../shared/services/reportsService'
import type { PaginatedResponse } from '../../../../types/api'
import type { PlanConsumptionItemDto } from '../../shared/types/reports'
import React from 'react'

const emptyResponse: PaginatedResponse<PlanConsumptionItemDto> = {
  items: [],
  totalCount: 0,
  page: 1,
  pageSize: 25,
  totalPages: 0,
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children)
}

describe('usePlanConsumption', () => {
  beforeEach(() => {
    vi.spyOn(reportsService, 'listPlanConsumption').mockResolvedValue(emptyResponse)
  })

  it('inicia com page=1 e pageSize=25', () => {
    const { result } = renderHook(() => usePlanConsumption(), { wrapper: createWrapper() })
    expect(result.current.page).toBe(1)
    expect(result.current.pageSize).toBe(25)
  })

  it('inicia com filtros vazios', () => {
    const { result } = renderHook(() => usePlanConsumption(), { wrapper: createWrapper() })
    expect(result.current.filters.search).toBe('')
    expect(result.current.filters.planId).toBeNull()
    expect(result.current.filters.from).toBeNull()
    expect(result.current.filters.to).toBeNull()
  })

  it('enabled=true sempre (não requer filtros obrigatórios)', () => {
    const spy = vi.spyOn(reportsService, 'listPlanConsumption').mockResolvedValue(emptyResponse)
    renderHook(() => usePlanConsumption(), { wrapper: createWrapper() })
    // Query é disparada mesmo sem filtros preenchidos
    expect(spy).toHaveBeenCalled()
  })

  it('ao mudar filtro reseta page para 1', () => {
    const { result } = renderHook(() => usePlanConsumption(), { wrapper: createWrapper() })

    act(() => result.current.setPage(3))
    expect(result.current.page).toBe(3)

    act(() => result.current.setFilters({ search: 'teste' }))
    expect(result.current.page).toBe(1)
    expect(result.current.filters.search).toBe('teste')
  })

  it('ao mudar planId reseta page para 1', () => {
    const { result } = renderHook(() => usePlanConsumption(), { wrapper: createWrapper() })

    act(() => result.current.setPage(2))
    act(() => result.current.setFilters({ planId: 'plan-123' }))

    expect(result.current.page).toBe(1)
    expect(result.current.filters.planId).toBe('plan-123')
  })

  it('ao mudar período reseta page para 1', () => {
    const { result } = renderHook(() => usePlanConsumption(), { wrapper: createWrapper() })

    act(() => result.current.setPage(4))
    act(() => result.current.setFilters({ from: '2024-01-01', to: '2024-01-31' }))

    expect(result.current.page).toBe(1)
    expect(result.current.filters.from).toBe('2024-01-01')
    expect(result.current.filters.to).toBe('2024-01-31')
  })

  it('chama listPlanConsumption com os filtros corretos', async () => {
    const spy = vi.spyOn(reportsService, 'listPlanConsumption').mockResolvedValue(emptyResponse)

    const { result } = renderHook(() => usePlanConsumption(), { wrapper: createWrapper() })

    act(() => result.current.setFilters({ search: 'cliente', planId: 'plano-abc' }))

    // Aguarda a query ser chamada com os novos filtros
    await vi.waitFor(() => {
      const lastCall = spy.mock.calls[spy.mock.calls.length - 1]?.[0]
      expect(lastCall?.search).toBe('cliente')
      expect(lastCall?.planId).toBe('plano-abc')
    })
  })
})
