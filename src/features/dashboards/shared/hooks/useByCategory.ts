import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { getByCategory } from '../services/metricsService'
import type { MetricsScope } from '../types/metrics'

type UseByCategoryParams = {
  scope: MetricsScope
  from: string | null
  to: string | null
  clientId?: string | null
  supportPlanId?: string | null
}

/**
 * Hook de chamados por categoria.
 * staleTime 2min.
 */
export function useByCategory(params: UseByCategoryParams) {
  return useQuery({
    queryKey: [
      'metrics-by-category',
      params.scope,
      params.from,
      params.to,
      params.clientId,
      params.supportPlanId,
    ],
    queryFn: () => getByCategory(params),
    staleTime: 2 * 60 * 1000,
    placeholderData: keepPreviousData,
  })
}
