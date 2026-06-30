import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, act, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { format, startOfMonth } from 'date-fns'

vi.mock('../services/movimentacaoDiariaService', () => ({
  listMovimentacaoDiaria: vi.fn(),
}))

import { listMovimentacaoDiaria } from '../services/movimentacaoDiariaService'
import { useMovimentacaoDiariaLogs, buildScope } from './useMovimentacaoDiariaLogs'
import type { PaginatedResponse } from '../../../types/api'
import type { MovimentacaoDiariaRowDto } from '../types/movimentacaoDiaria'

const emptyResponse: PaginatedResponse<MovimentacaoDiariaRowDto> = {
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
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe('buildScope', () => {
  it('null → global', () => {
    expect(buildScope(null)).toBe('global')
  })

  it('id de equipe → team:{id}', () => {
    expect(buildScope(7)).toBe('team:7')
  })
})

describe('useMovimentacaoDiariaLogs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(listMovimentacaoDiaria).mockResolvedValue(emptyResponse)
  })

  it('default: ordena por data desc, scope global, page 1', async () => {
    renderHook(() => useMovimentacaoDiariaLogs(), { wrapper: createWrapper() })

    await waitFor(() => expect(listMovimentacaoDiaria).toHaveBeenCalled())

    const arg = vi.mocked(listMovimentacaoDiaria).mock.calls[0][0]
    expect(arg).toMatchObject({
      scope: 'global',
      sortBy: 'data',
      sortDirection: 'desc',
      page: 1,
      pageSize: 25,
    })
  })

  it('default: período = mês corrente (1º dia → hoje) e é clearable', async () => {
    const today = new Date()
    const { result } = renderHook(() => useMovimentacaoDiariaLogs(), {
      wrapper: createWrapper(),
    })
    await waitFor(() => expect(listMovimentacaoDiaria).toHaveBeenCalled())

    expect(result.current.filters.from).toBe(format(startOfMonth(today), 'yyyy-MM-dd'))
    expect(result.current.filters.to).toBe(format(today, 'yyyy-MM-dd'))

    act(() => result.current.setFilters({ from: null, to: null }))
    expect(result.current.filters.from).toBeNull()
    expect(result.current.filters.to).toBeNull()
  })

  it('filtro por equipe monta scope team:{id} (sem duplicar equipeId)', async () => {
    const { result } = renderHook(() => useMovimentacaoDiariaLogs(), {
      wrapper: createWrapper(),
    })
    await waitFor(() => expect(listMovimentacaoDiaria).toHaveBeenCalled())

    act(() => result.current.setFilters({ equipeId: 3 }))

    await waitFor(() => {
      const last = vi.mocked(listMovimentacaoDiaria).mock.calls.at(-1)?.[0]
      expect(last?.scope).toBe('team:3')
    })
    // O scope team:{id} já carrega a equipe — não duplicamos equipeId na query.
    const last = vi.mocked(listMovimentacaoDiaria).mock.calls.at(-1)?.[0]
    expect(last?.equipeId).toBeUndefined()
  })

  it('filtro de bucket repassa statusBucket; vazio vira undefined', async () => {
    const { result } = renderHook(() => useMovimentacaoDiariaLogs(), {
      wrapper: createWrapper(),
    })
    await waitFor(() => expect(listMovimentacaoDiaria).toHaveBeenCalled())

    act(() => result.current.setFilters({ statusBucket: ['emandamento'] }))

    await waitFor(() => {
      const last = vi.mocked(listMovimentacaoDiaria).mock.calls.at(-1)?.[0]
      expect(last?.statusBucket).toEqual(['emandamento'])
    })

    act(() => result.current.setFilters({ statusBucket: [] }))

    await waitFor(() => {
      const last = vi.mocked(listMovimentacaoDiaria).mock.calls.at(-1)?.[0]
      expect(last?.statusBucket).toBeUndefined()
    })
  })

  it('setSort na mesma coluna inverte a direção', async () => {
    const { result } = renderHook(() => useMovimentacaoDiariaLogs(), {
      wrapper: createWrapper(),
    })
    await waitFor(() => expect(listMovimentacaoDiaria).toHaveBeenCalled())

    // default já é data/desc → clicar inverte para asc
    act(() => result.current.setSort('data'))

    await waitFor(() => {
      const last = vi.mocked(listMovimentacaoDiaria).mock.calls.at(-1)?.[0]
      expect(last?.sortBy).toBe('data')
      expect(last?.sortDirection).toBe('asc')
    })
  })
})
