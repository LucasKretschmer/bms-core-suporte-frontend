import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { getPlanHealth } from '../services/metricsService'
import type { MetricsScope } from '../types/metrics'

type UsePlanHealthParams = {
  scope: MetricsScope
  from: string | null
  to: string | null
  clientId?: string | null
  supportPlanId?: string | null
}

/**
 * Hook de saúde dos planos.
 * Gráfico sempre scope=global (conforme análise §8.2).
 * staleTime 2min.
 */
export function usePlanHealth(params: UsePlanHealthParams) {
  return useQuery({
    queryKey: [
      'metrics-plan-health',
      params.scope,
      params.from,
      params.to,
      params.clientId,
      params.supportPlanId,
    ],
    queryFn: () => getPlanHealth(params),
    staleTime: 2 * 60 * 1000,
    placeholderData: keepPreviousData,
  })
}
