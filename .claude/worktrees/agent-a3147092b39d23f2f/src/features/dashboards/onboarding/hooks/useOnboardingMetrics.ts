import { useQuery } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { getOnboardingMetrics } from '../services/onboardingService'

type UseOnboardingMetricsParams = {
  from: string | null
  to: string | null
}

/**
 * Hook de métricas de Onboarding.
 * Trata 404 graciosamente (endpoint em implantação) — isError: false, data: undefined.
 * NPS sempre null (placeholder).
 * staleTime 2min.
 */
export function useOnboardingMetrics(params: UseOnboardingMetricsParams) {
  return useQuery({
    queryKey: ['metrics-onboarding', params.from, params.to],
    queryFn: () => getOnboardingMetrics({ ...params, gerencia: 'onboarding' }),
    staleTime: 2 * 60 * 1000,
    retry: (failureCount, error) => {
      // Não retentar em 404 — endpoint ainda em implantação
      if (isAxiosError(error) && error.response?.status === 404) return false
      return failureCount < 3
    },
  })
}
