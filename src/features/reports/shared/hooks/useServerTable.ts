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

/**
 * 🔴 **132/F4d — o 3º genérico existe para NÃO ESTREITAR a resposta.**
 *
 * `TResp` tem default `PaginatedResponse<TRow>`, então os call sites existentes não mudam uma
 * linha. Sem ele, uma resposta que HERDA de `PaginatedResponse` (o envelope de D12, com
 * `fonte`/`competencia`/`aviso*`) perderia os campos extras **no tipo**: eles existiriam em
 * runtime e a tela não conseguiria lê-los sem `as`, que é proibido. O selo de mês fechado
 * simplesmente nunca apareceria, sem erro nenhum.
 */
type UseServerTableOptions<TFilters, TResp> = {
  queryKey: string
  queryFn: (params: TableParams<TFilters>) => Promise<TResp>
  initialFilters: TFilters
  initialPageSize?: number
  initialSortBy?: string | null
  initialSortDirection?: 'asc' | 'desc'
  /** false = suspende a query (aguardar filtros obrigatórios como clientId) */
  enabled?: boolean
}

type UseServerTableReturn<TFilters, TResp> = {
  data: TResp | undefined
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
export function useServerTable<
  TFilters extends object,
  TRow,
  TResp extends PaginatedResponse<TRow> = PaginatedResponse<TRow>,
>({
  queryKey,
  queryFn,
  initialFilters,
  initialPageSize = 25,
  initialSortBy = null,
  initialSortDirection = 'desc',
  enabled = true,
}: UseServerTableOptions<TFilters, TResp>): UseServerTableReturn<TFilters, TResp> {
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
    if (sortBy === newSortBy) {
      // Mesma coluna → inverte direção (asc ↔ desc)
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      // Outra coluna → começa decrescente por padrão
      setSortBy(newSortBy)
      setSortDirection('desc')
    }
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
