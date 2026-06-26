import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import type { PaginatedResponse } from '../../../../types/api'

export type TableParams<TFilters> = {
  page: number
  pageSize: number
  sortBy: string | null
  sortDirection: 'asc' | 'desc'
  filters: TFilters
}

type UseServerTableOptions<TFilters, TRow> = {
  queryKey: string
  queryFn: (params: TableParams<TFilters>) => Promise<PaginatedResponse<TRow>>
  initialFilters: TFilters
  initialPageSize?: number
  initialSortBy?: string | null
  initialSortDirection?: 'asc' | 'desc'
  /** false = suspende a query (aguardar filtros obrigatórios como clientId) */
  enabled?: boolean
}

type UseServerTableReturn<TFilters, TRow> = {
  data: PaginatedResponse<TRow> | undefined
  isLoading: boolean
  isError: boolean
  refetch: () => void
  // Estado
  page: number
  pageSize: number
  sortBy: string | null
  sortDirection: 'asc' | 'desc'
  filters: TFilters
  // Setters
  setPage: (page: number) => void
  setPageSize: (size: number) => void
  /** Toggle asc/desc ao clicar na mesma coluna; desc por padrão ao mudar coluna */
  setSort: (sortBy: string) => void
  setFilters: (filters: Partial<TFilters>) => void
  resetFilters: () => void
}

/**
 * Hook genérico de tabela server-side.
 * Gerencia page/pageSize/sortBy/sortDirection/filters e dispara useQuery.
 * Toda paginação e ordenação é server-side — nunca paginar em memória.
 *
 * queryKey inclui todos os parâmetros para cache correto por filtro.
 */
export function useServerTable<TFilters extends object, TRow>({
  queryKey,
  queryFn,
  initialFilters,
  initialPageSize = 25,
  initialSortBy = null,
  initialSortDirection = 'desc',
  enabled = true,
}: UseServerTableOptions<TFilters, TRow>): UseServerTableReturn<TFilters, TRow> {
  const [page, setPageState] = useState(1)
  const [pageSize, setPageSizeState] = useState(initialPageSize)
  const [sortBy, setSortBy] = useState<string | null>(initialSortBy)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>(initialSortDirection)
  const [filters, setFiltersState] = useState<TFilters>(initialFilters)

  const params: TableParams<TFilters> = { page, pageSize, sortBy, sortDirection, filters }

  const { data, isLoading, isError, refetch } = useQuery({
    // queryKey inclui todos os parâmetros → cache correto por combinação
    queryKey: [queryKey, page, pageSize, sortBy, sortDirection, filters],
    queryFn: () => queryFn(params),
    enabled,
  })

  function setPage(p: number) {
    setPageState(p)
  }

  function setPageSize(size: number) {
    setPageSizeState(size)
    setPageState(1) // Reseta para primeira página ao mudar pageSize
  }

  function setSort(newSortBy: string) {
    setSortBy((prev) => {
      if (prev === newSortBy) {
        // Mesma coluna → inverte direção
        setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'))
        return newSortBy
      } else {
        // Outra coluna → desc por padrão
        setSortDirection('desc')
        return newSortBy
      }
    })
    setPageState(1)
  }

  function setFilters(partial: Partial<TFilters>) {
    setFiltersState((prev) => ({ ...prev, ...partial }))
    setPageState(1) // Reseta para primeira página ao filtrar
  }

  function resetFilters() {
    setFiltersState(initialFilters)
    setPageState(1)
  }

  return {
    data,
    isLoading,
    isError,
    refetch,
    page,
    pageSize,
    sortBy,
    sortDirection,
    filters,
    setPage,
    setPageSize,
    setSort,
    setFilters,
    resetFilters,
  }
}
