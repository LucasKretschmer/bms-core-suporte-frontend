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
 * staleTime 2min. Retorna a união discriminada `StatusDistributionDto`.
 *
 * A `queryKey` inclui `scope` → ao alternar global↔equipe a query reexecuta e a
 * forma do dado muda. NÃO incluir `byTeam` na key (vem do dado). Com
 * `keepPreviousData`, o consumidor deve SEMPRE discriminar por `data.byTeam` a cada
 * render (não assumir a forma) — o shape antigo pode persistir por 1 render na troca
 * de scope.
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
