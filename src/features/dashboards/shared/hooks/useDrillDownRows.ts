import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getDrillDownRows } from '../services/metricsService'
import type { MetricsBaseParams, TimeEntryRowDto } from '../types/metrics'
import type { PaginatedResponse } from '../../../../types/api'

type DrillDownFilters = {
  sortBy: string | null
  sortDirection: 'asc' | 'desc'
}

type UseDrillDownRowsReturn = {
  data: PaginatedResponse<TimeEntryRowDto> | undefined
  isLoading: boolean
  isError: boolean
  refetch: () => void
  page: number
  pageSize: number
  sortBy: string | null
  sortDirection: 'asc' | 'desc'
  setPage: (page: number) => void
  setPageSize: (size: number) => void
  setSort: (sortBy: string) => void
  /** Ativa a query (chamado pelo DrillDownModal ao abrir) */
  enable: () => void
  /** Desativa a query (chamado ao fechar) */
  disable: () => void
  isEnabled: boolean
}

/**
 * Hook de drill-down de linhas (rows) via overview?format=rows.
 * enabled: false na inicialização — ativado pelo DrillDownModal ao abrir.
 * Gerencia paginação e ordenação localmente.
 */
export function useDrillDownRows(baseParams: MetricsBaseParams): UseDrillDownRowsReturn {
  const [isEnabled, setIsEnabled] = useState(false)
  const [page, setPageState] = useState(1)
  const [pageSize, setPageSizeState] = useState(25)
  const [sortBy, setSortBy] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: [
      'drill-down-rows',
      baseParams.scope,
      baseParams.from,
      baseParams.to,
      baseParams.clientId,
      baseParams.supportPlanId,
      page,
      pageSize,
      sortBy,
      sortDirection,
    ],
    queryFn: () =>
      getDrillDownRows({
        ...baseParams,
        format: 'rows',
        page,
        pageSize,
        sortBy,
        sortDirection,
      }),
    enabled: isEnabled,
    staleTime: 2 * 60 * 1000,
  })

  function setPage(p: number) {
    setPageState(p)
  }

  function setPageSize(size: number) {
    setPageSizeState(size)
    setPageState(1)
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

  function enable() {
    setIsEnabled(true)
  }

  function disable() {
    setIsEnabled(false)
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
    setPage,
    setPageSize,
    setSort,
    enable,
    disable,
    isEnabled,
  }
}

export type { DrillDownFilters }
