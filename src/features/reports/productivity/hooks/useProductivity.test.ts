import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, act } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { useProductivity } from './useProductivity'
import * as reportsService from '../../shared/services/reportsService'
import type { PaginatedResponse } from '../../../../types/api'
import type { AgentMetricDto } from '../../shared/types/reports'
import React from 'react'

const emptyResponse: PaginatedResponse<AgentMetricDto> = {
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

describe('useProductivity', () => {
  beforeEach(() => {
    vi.spyOn(reportsService, 'listProductivity').mockResolvedValue(emptyResponse)
  })

  it('inicia com page=1 e pageSize=25', () => {
    const { result } = renderHook(() => useProductivity(), { wrapper: createWrapper() })
    expect(result.current.page).toBe(1)
    expect(result.current.pageSize).toBe(25)
  })

  it('inicia com filtros vazios', () => {
    const { result } = renderHook(() => useProductivity(), { wrapper: createWrapper() })
    expect(result.current.filters.from).toBeNull()
    expect(result.current.filters.to).toBeNull()
    expect(result.current.filters.teamId).toBeNull()
  })

  it('dispara a query (enabled=true por padrão)', () => {
    const spy = vi.spyOn(reportsService, 'listProductivity').mockResolvedValue(emptyResponse)
    renderHook(() => useProductivity(), { wrapper: createWrapper() })
    expect(spy).toHaveBeenCalled()
  })

  it('ao mudar filtro de período reseta page para 1', () => {
    const { result } = renderHook(() => useProductivity(), { wrapper: createWrapper() })

    act(() => result.current.setPage(3))
    expect(result.current.page).toBe(3)

    act(() => result.current.setFilters({ from: '2024-01-01', to: '2024-01-31' }))
    expect(result.current.page).toBe(1)
    expect(result.current.filters.from).toBe('2024-01-01')
  })

  it('ao mudar teamId reseta page para 1', () => {
    const { result } = renderHook(() => useProductivity(), { wrapper: createWrapper() })

    act(() => result.current.setPage(2))
    act(() => result.current.setFilters({ teamId: 'team-abc' }))

    expect(result.current.page).toBe(1)
    expect(result.current.filters.teamId).toBe('team-abc')
  })

  it('chama listProductivity com os filtros corretos', async () => {
    const spy = vi.spyOn(reportsService, 'listProductivity').mockResolvedValue(emptyResponse)

    const { result } = renderHook(() => useProductivity(), { wrapper: createWrapper() })

    act(() => result.current.setFilters({ teamId: 'team-1', from: '2024-01-01' }))

    await vi.waitFor(() => {
      const lastCall = spy.mock.calls[spy.mock.calls.length - 1]?.[0]
      expect(lastCall?.teamId).toBe('team-1')
      expect(lastCall?.from).toBe('2024-01-01')
    })
  })
})

import { productivityColumns } from '../columns'

describe('useProductivity — AHT null exibe "—"', () => {
  it('coluna AHT exibe "—" quando ahtSegundos é null', () => {
    const ahtCol = productivityColumns.find((c) => c.key === 'ahtSegundos')
    const rowWithNull: AgentMetricDto = {
      userId: '1',
      nome: 'Analista',
      equipe: null,
      nAtendimentos: 10,
      totalSegundos: 3600,
      ahtSegundos: null,
      mediaPausas: null,
    }
    expect(ahtCol?.accessor(rowWithNull)).toBe('—')
  })

  it('coluna AHT formata segundos quando ahtSegundos não é null', () => {
    const ahtCol = productivityColumns.find((c) => c.key === 'ahtSegundos')
    const rowWithValue: AgentMetricDto = {
      userId: '2',
      nome: 'Analista',
      equipe: 'Equipe A',
      nAtendimentos: 5,
      totalSegundos: 7200,
      ahtSegundos: 1440,
      mediaPausas: 2.5,
    }
    expect(ahtCol?.accessor(rowWithValue)).toBe('0h 24m')
  })
})
