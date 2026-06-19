/**
 * Serviço de métricas de Onboarding.
 * GET /api/v1/metrics/onboarding
 * Tolera tabela Project vazia — backend retorna zeros, nunca 500.
 * NPS é sempre placeholder.
 */

import { api } from '../../../../services/api'
import type { OnboardingMetricsDto } from '../../shared/types/metrics'

type OnboardingParams = {
  from?: string | null
  to?: string | null
  gerencia?: 'onboarding'
}

function cleanParams(params: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== null && v !== undefined && v !== ''),
  )
}

export async function getOnboardingMetrics(
  params: OnboardingParams,
): Promise<OnboardingMetricsDto> {
  const { data } = await api.get<OnboardingMetricsDto>(
    '/api/v1/metrics/onboarding',
    {
      params: cleanParams({
        ...params,
        gerencia: params.gerencia ?? 'onboarding',
      } as Record<string, unknown>),
    },
  )
  return data
}
