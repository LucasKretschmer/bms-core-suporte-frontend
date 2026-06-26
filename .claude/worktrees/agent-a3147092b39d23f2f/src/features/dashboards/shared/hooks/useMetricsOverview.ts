import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { getMetricsOverview } from '../services/metricsService'
import type { MetricsScope } from '../types/metrics'

type UseMetricsOverviewParams = {
  scope: MetricsScope
  from: string | null
  to: string | null
  clientId?: string | null
  supportPlanId?: string | null
}

/**
 * Hook de métricas gerais (KPI cards).
 * staleTime 2min — refetch via SSE em caso de evento relevante.
 */
export function useMetricsOverview(params: UseMetricsOverviewParams) {
  return useQuery({
    queryKey: [
      'metrics-overview',
      params.scope,
      params.from,
      params.to,
      params.clientId,
      params.supportPlanId,
    ],
    queryFn: () => getMetricsOverview(params),
    staleTime: 2 * 60 * 1000,
    placeholderData: keepPreviousData,
  })
}
