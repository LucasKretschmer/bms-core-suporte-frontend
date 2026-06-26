import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, act } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useServerTable } from './useServerTable'
import type { PaginatedResponse } from '../../../../types/api'

type TestFilters = { search: string; status: string | null }

const initialFilters: TestFilters = { search: '', status: null }

const emptyResponse: PaginatedResponse<Record<string, string>> = {
  items: [],
  totalCount: 0,
  page: 1,
  pageSize: 25,
  totalPages: 0,
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe('useServerTable', () => {
  it('inicia com page=1 e pageSize=25 por padrão', () => {
    const queryFn = vi.fn().mockResolvedValue(emptyResponse)
    const { result } = renderHook(
      () =>
        useServerTable({
          queryKey: 'test',
          queryFn,
          initialFilters,
        }),
      { wrapper: createWrapper() },
    )
    expect(result.current.page).toBe(1)
    expect(result.current.pageSize).toBe(25)
  })

  it('setFilters reseta page para 1', () => {
    const queryFn = vi.fn().mockResolvedValue(emptyResponse)
    const { result } = renderHook(
      () =>
        useServerTable({
          queryKey: 'test',
          queryFn,
          initialFilters,
        }),
      { wrapper: createWrapper() },
    )

    // Vai para página 3
    act(() => result.current.setPage(3))
    expect(result.current.page).toBe(3)

    // Muda filtro → deve voltar para 1
    act(() => result.current.setFilters({ search: 'teste' }))
    expect(result.current.page).toBe(1)
  })

  it('setPageSize reseta page para 1', () => {
    const queryFn = vi.fn().mockResolvedValue(emptyResponse)
    const { result } = renderHook(
      () =>
        useServerTable({
          queryKey: 'test',
          queryFn,
          initialFilters,
        }),
      { wrapper: createWrapper() },
    )

    act(() => result.current.setPage(5))
    expect(result.current.page).toBe(5)

    act(() => result.current.setPageSize(50))
    expect(result.current.page).toBe(1)
    expect(result.current.pageSize).toBe(50)
  })

  it('setSort na mesma coluna inverte direção', () => {
    const queryFn = vi.fn().mockResolvedValue(emptyResponse)
    const { result } = renderHook(
      () =>
        useServerTable({
          queryKey: 'test',
          queryFn,
          initialFilters,
          initialSortBy: 'nome',
          initialSortDirection: 'asc',
        }),
      { wrapper: createWrapper() },
    )

    expect(result.current.sortBy).toBe('nome')
    expect(result.current.sortDirection).toBe('asc')

    // Clicar na mesma coluna → inverte
    act(() => result.current.setSort('nome'))
    expect(result.current.sortDirection).toBe('desc')

    // Clicar de novo → inverte de volta
    act(() => result.current.setSort('nome'))
    expect(result.current.sortDirection).toBe('asc')
  })

  it('setSort em coluna diferente vai para desc por padrão', () => {
    const queryFn = vi.fn().mockResolvedValue(emptyResponse)
    const { result } = renderHook(
      () =>
        useServerTable({
          queryKey: 'test',
          queryFn,
          initialFilters,
          initialSortBy: 'nome',
          initialSortDirection: 'asc',
        }),
      { wrapper: createWrapper() },
    )

    act(() => result.current.setSort('email'))
    expect(result.current.sortBy).toBe('email')
    expect(result.current.sortDirection).toBe('desc')
  })

  it('resetFilters volta para filtros iniciais e page 1', () => {
    const queryFn = vi.fn().mockResolvedValue(emptyResponse)
    const { result } = renderHook(
      () =>
        useServerTable({
          queryKey: 'test',
          queryFn,
          initialFilters,
        }),
      { wrapper: createWrapper() },
    )

    act(() => {
      result.current.setFilters({ search: 'teste', status: 'ativo' })
      result.current.setPage(4)
    })

    act(() => result.current.resetFilters())
    expect(result.current.filters).toEqual(initialFilters)
    expect(result.current.page).toBe(1)
  })

  it('não dispara query quando enabled=false', () => {
    const queryFn = vi.fn().mockResolvedValue(emptyResponse)
    renderHook(
      () =>
        useServerTable({
          queryKey: 'test',
          queryFn,
          initialFilters,
          enabled: false,
        }),
      { wrapper: createWrapper() },
    )
    // queryFn não deve ser chamado
    expect(queryFn).not.toHaveBeenCalled()
  })
})
