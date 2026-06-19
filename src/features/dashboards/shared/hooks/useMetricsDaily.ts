import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { getMetricsDaily } from '../services/metricsService'
import type { MetricsScope } from '../types/metrics'

type UseMetricsDailyParams = {
  scope: MetricsScope
  from: string | null
  to: string | null
  clientId?: string | null
  supportPlanId?: string | null
}

/**
 * Hook de movimentação diária (gráfico de 5 linhas).
 * staleTime 2min.
 */
export function useMetricsDaily(params: UseMetricsDailyParams) {
  return useQuery({
    queryKey: [
      'metrics-daily',
      params.scope,
      params.from,
      params.to,
      params.clientId,
      params.supportPlanId,
    ],
    queryFn: () => getMetricsDaily(params),
    staleTime: 2 * 60 * 1000,
    placeholderData: keepPreviousData,
  })
}
