/**
 * Hook de drill-down paramétrico GENÉRICO (016).
 *
 * Controlado por `activeDrill: DrillSpec | null` — quando null, a query fica
 * desabilitada (enabled:false). Ao definir um DrillSpec, dispara GET /metrics/rows
 * com os MESMOS filtros/scope/período da tela (baseParams) + os params do metric.
 *
 * É agnóstico de família: o `metric` do DrillSpec determina o tipo de linha T retornado
 * (ticket → TicketRowDto, apontamento → TimeEntryDrillRowDto, cliente → ClientRowDto,
 * projeto → ProjectRowDto). O chamador informa T via parâmetro genérico.
 *
 * A queryKey inclui todos os filtros da tela e o metric/params — garante consistência
 * número↔linhas e cache correto por combinação (A01).
 *
 * Paginação e ordenação locais (resetadas quando o drill muda).
 */

import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getMetricRows } from '../services/metricsService'
import type { DrillSpec, MetricsBaseParams } from '../types/metrics'
import type { PaginatedResponse } from '../../../../types/api'

export type UseMetricDrillReturn<T> = {
  data: PaginatedResponse<T> | undefined
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

export function useMetricDrill<T>(
  activeDrill: DrillSpec | null,
  baseParams: MetricsBaseParams,
): UseMetricDrillReturn<T> {
  const [page, setPageState] = useState(1)
  const [pageSize, setPageSizeState] = useState(25)
  const [sortBy, setSortBy] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')

  const p = activeDrill?.params

  // Resetar paginação/ordenação ao trocar de drill (metric ou params).
  const drillKey = activeDrill
    ? [
        activeDrill.metric,
        p?.statusKey ?? '',
        p?.stageId ?? '',
        p?.sla ?? '',
        p?.billing ?? '',
        p?.serviceCategory ?? '',
        p?.categoria ?? '',
        p?.userId ?? '',
        p?.faixa ?? '',
        p?.tipo ?? '',
        p?.stage ?? '',
      ].join('|')
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
      p?.statusKey,
      p?.stageId,
      p?.sla,
      p?.billing,
      p?.serviceCategory,
      p?.categoria,
      p?.userId,
      p?.faixa,
      p?.tipo,
      p?.stage,
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
      getMetricRows<T>({
        metric: activeDrill!.metric,
        scope: baseParams.scope,
        from: baseParams.from,
        to: baseParams.to,
        clientId: baseParams.clientId,
        supportPlanId: baseParams.supportPlanId,
        statusKey: p?.statusKey ?? null,
        stageId: p?.stageId ?? null,
        sla: p?.sla ?? null,
        billing: p?.billing ?? null,
        serviceCategory: p?.serviceCategory ?? null,
        categoria: p?.categoria ?? null,
        userId: p?.userId ?? null,
        faixa: p?.faixa ?? null,
        tipo: p?.tipo ?? null,
        stage: p?.stage ?? null,
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
