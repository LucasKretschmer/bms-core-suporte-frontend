/**
 * Hook de drill-down paramétrico da família TICKET (016).
 *
 * Controlado por `activeDrill: DrillSpec | null` — quando null, a query fica
 * desabilitada (enabled:false). Ao definir um DrillSpec, dispara GET /metrics/rows
 * com os MESMOS filtros/scope/período da tela (baseParams) + os params do metric.
 *
 * A queryKey inclui todos os filtros da tela e o metric/params — garante consistência
 * número↔linhas e cache correto por combinação (A01).
 *
 * Paginação e ordenação locais (resetadas quando o drill muda).
 */

import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getMetricRows } from '../services/metricsService'
import type {
  DrillSpec,
  MetricsBaseParams,
  TicketRowDto,
} from '../types/metrics'
import type { PaginatedResponse } from '../../../../types/api'

export type UseTicketDrillReturn = {
  data: PaginatedResponse<TicketRowDto> | undefined
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
  /** true quando há um drill ativo (modal aberto). */
  isActive: boolean
}

export function useTicketDrill(
  activeDrill: DrillSpec | null,
  baseParams: MetricsBaseParams,
): UseTicketDrillReturn {
  const [page, setPageState] = useState(1)
  const [pageSize, setPageSizeState] = useState(25)
  const [sortBy, setSortBy] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')

  // Resetar paginação/ordenação ao trocar de drill (metric ou params).
  const drillKey = activeDrill
    ? `${activeDrill.metric}|${activeDrill.params?.statusKey ?? ''}|${activeDrill.params?.stageId ?? ''}|${activeDrill.params?.sla ?? ''}`
    : null

  useEffect(() => {
    setPageState(1)
    setSortBy(null)
    setSortDirection('desc')
  }, [drillKey])

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: [
      'metric-rows',
      activeDrill?.metric,
      activeDrill?.params?.statusKey,
      activeDrill?.params?.stageId,
      activeDrill?.params?.sla,
      baseParams.scope,
      baseParams.from,
      baseParams.to,
      baseParams.clientId,
      page,
      pageSize,
      sortBy,
      sortDirection,
    ],
    queryFn: () =>
      getMetricRows({
        metric: activeDrill!.metric,
        scope: baseParams.scope,
        from: baseParams.from,
        to: baseParams.to,
        clientId: baseParams.clientId,
        statusKey: activeDrill!.params?.statusKey ?? null,
        stageId: activeDrill!.params?.stageId ?? null,
        sla: activeDrill!.params?.sla ?? null,
        page,
        pageSize,
        sortBy,
        sortDirection,
      }),
    enabled: activeDrill !== null,
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
    setSortBy((prev) => {
      if (prev === newSortBy) {
        setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'))
        return newSortBy
      }
      setSortDirection('desc')
      return newSortBy
    })
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
    isActive: activeDrill !== null,
  }
}
