import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { getByAgent } from '../services/metricsService'
import type { MetricsScope } from '../types/metrics'

type UseByAgentParams = {
  scope: MetricsScope
  from: string | null
  to: string | null
  clientId?: string | null
  supportPlanId?: string | null
}

/**
 * Hook de métricas por agente/atendente.
 * staleTime 2min.
 */
export function useByAgent(params: UseByAgentParams) {
  return useQuery({
    queryKey: [
      'metrics-by-agent',
      params.scope,
      params.from,
      params.to,
      params.clientId,
      params.supportPlanId,
    ],
    queryFn: () => getByAgent(params),
    staleTime: 2 * 60 * 1000,
    placeholderData: keepPreviousData,
  })
}
