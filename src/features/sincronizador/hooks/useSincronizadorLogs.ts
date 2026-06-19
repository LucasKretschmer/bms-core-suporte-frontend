import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { listSincronizacaoLogs } from '../services/sincronizadorService'
import type { SyncStatus } from '../types/sincronizador'

type AllowedSortKey = 'iniciadoem' | 'status' | 'duracaoms'

const ALLOWED_SORT_KEYS: AllowedSortKey[] = ['iniciadoem', 'status', 'duracaoms']

/**
 * Hook de logs do sincronizador.
 * Gerencia paginação, filtro por status, ordenação.
 * keepPreviousData evita flash de loading ao mudar página.
 */
export function useSincronizadorLogs() {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [statusFilter, setStatusFilter] = useState<SyncStatus | undefined>(undefined)
  const [sortBy, setSortBy] = useState<AllowedSortKey>('iniciadoem')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')

  const query = useQuery({
    queryKey: ['sincronizador-logs', page, pageSize, statusFilter, sortBy, sortDirection],
    queryFn: () =>
      listSincronizacaoLogs({
        page,
        pageSize,
        status: statusFilter,
        sortBy,
        sortDirection,
      }),
    staleTime: 10_000,
    placeholderData: keepPreviousData,
  })

  function handleSort(key: string) {
    const validKey = ALLOWED_SORT_KEYS.find((k) => k === key)
    if (!validKey) return
    if (sortBy === validKey) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(validKey)
      setSortDirection('desc')
    }
    setPage(1)
  }

  function handleStatusFilter(value: string) {
    setStatusFilter(value === '' ? undefined : (value as SyncStatus))
    setPage(1)
  }

  return {
    query,
    page,
    setPage,
    pageSize,
    setPageSize,
    statusFilter,
    handleStatusFilter,
    sortBy,
    sortDirection,
    handleSort,
  }
}
