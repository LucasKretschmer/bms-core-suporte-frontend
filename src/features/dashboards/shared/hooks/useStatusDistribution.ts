import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { getStatusDistribution } from '../services/metricsService'
import type { MetricsScope } from '../types/metrics'

type UseStatusDistributionParams = {
  scope: MetricsScope
  from: string | null
  to: string | null
  clientId?: string | null
  supportPlanId?: string | null
}

/**
 * Hook de distribuição por status de pipeline.
 * staleTime 2min.
 */
export function useStatusDistribution(params: UseStatusDistributionParams) {
  return useQuery({
    queryKey: [
      'metrics-status-distribution',
      params.scope,
      params.from,
      params.to,
      params.clientId,
      params.supportPlanId,
    ],
    queryFn: () => getStatusDistribution(params),
    staleTime: 2 * 60 * 1000,
    placeholderData: keepPreviousData,
  })
}
