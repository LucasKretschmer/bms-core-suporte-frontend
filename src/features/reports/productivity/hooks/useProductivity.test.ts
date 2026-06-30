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

  it('inicia com período = mês corrente (1º dia do mês → hoje) e teamId nulo', () => {
    vi.useFakeTimers()
    // Data fixa no meio do mês para validar o 1º dia do mês como "from".
    vi.setSystemTime(new Date(2024, 4, 15, 10, 30, 0)) // 2024-05-15

    const { result } = renderHook(() => useProductivity(), { wrapper: createWrapper() })

    expect(result.current.filters.from).toBe('2024-05-01')
    expect(result.current.filters.to).toBe('2024-05-15')
    expect(result.current.filters.teamId).toBeNull()

    vi.useRealTimers()
  })

  it('usa o fuso local (format), não UTC — sem off-by-one na virada de mês', () => {
    vi.useFakeTimers()
    // 1º dia do mês à meia-noite local: toISOString daria o dia anterior em fusos negativos.
    vi.setSystemTime(new Date(2024, 2, 1, 0, 0, 0)) // 2024-03-01 00:00 local

    const { result } = renderHook(() => useProductivity(), { wrapper: createWrapper() })

    expect(result.current.filters.from).toBe('2024-03-01')
    expect(result.current.filters.to).toBe('2024-03-01')

    vi.useRealTimers()
  })

  it('inicia com teamId nulo (filtro de equipe não regride)', () => {
    const { result } = renderHook(() => useProductivity(), { wrapper: createWrapper() })
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

  // ── 056: plumbing de ordenação ──────────────────────────────────────────────

  it('inicia com ordenação default = totalsegundos desc (espelha o backend)', () => {
    const { result } = renderHook(() => useProductivity(), { wrapper: createWrapper() })
    expect(result.current.sortBy).toBe('totalsegundos')
    expect(result.current.sortDirection).toBe('desc')
  })

  it('passa sortBy/sortDirection default para listProductivity', async () => {
    const spy = vi.spyOn(reportsService, 'listProductivity').mockResolvedValue(emptyResponse)
    renderHook(() => useProductivity(), { wrapper: createWrapper() })

    await vi.waitFor(() => {
      const firstCall = spy.mock.calls[0]?.[0]
      expect(firstCall?.sortBy).toBe('totalsegundos')
      expect(firstCall?.sortDirection).toBe('desc')
    })
  })

  it('ao ordenar por outra coluna envia o sortKey com direção desc', async () => {
    const spy = vi.spyOn(reportsService, 'listProductivity').mockResolvedValue(emptyResponse)
    const { result } = renderHook(() => useProductivity(), { wrapper: createWrapper() })

    act(() => result.current.setSort('nome'))

    expect(result.current.sortBy).toBe('nome')
    expect(result.current.sortDirection).toBe('desc')

    await vi.waitFor(() => {
      const lastCall = spy.mock.calls[spy.mock.calls.length - 1]?.[0]
      expect(lastCall?.sortBy).toBe('nome')
      expect(lastCall?.sortDirection).toBe('desc')
    })
  })

  it('ao clicar de novo na mesma coluna inverte a direção (asc) e envia ao service', async () => {
    const spy = vi.spyOn(reportsService, 'listProductivity').mockResolvedValue(emptyResponse)
    const { result } = renderHook(() => useProductivity(), { wrapper: createWrapper() })

    // default = totalsegundos desc; clicar na mesma coluna inverte para asc
    act(() => result.current.setSort('totalsegundos'))

    expect(result.current.sortBy).toBe('totalsegundos')
    expect(result.current.sortDirection).toBe('asc')

    await vi.waitFor(() => {
      const lastCall = spy.mock.calls[spy.mock.calls.length - 1]?.[0]
      expect(lastCall?.sortBy).toBe('totalsegundos')
      expect(lastCall?.sortDirection).toBe('asc')
    })
  })

  it('ao ordenar reseta a página para 1', () => {
    const { result } = renderHook(() => useProductivity(), { wrapper: createWrapper() })

    act(() => result.current.setPage(4))
    expect(result.current.page).toBe(4)

    act(() => result.current.setSort('nome'))
    expect(result.current.page).toBe(1)
  })
})

import { productivityColumns } from '../columns'

describe('useProductivity — AHT null exibe "—"', () => {
  it('coluna AHT exibe "—" quando ahtSegundos é null', () => {
    const ahtCol = productivityColumns.find((c) => c.key === 'ahtSegundos')
    const rowWithNull: AgentMetricDto = {
      userId: 1,
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
      userId: 2,
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
