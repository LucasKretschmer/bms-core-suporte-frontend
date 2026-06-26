/**
 * Serviços de métricas — chamadas REST para /api/v1/metrics/*.
 * Funções puras; consumidas via useQuery/useMutation nos hooks.
 * Usa instância api centralizada — nunca axios direto.
 */

import { api } from '../../../../services/api'
import type { PaginatedResponse } from '../../../../types/api'
import type {
  MetricsBaseParams,
  MetricsOverviewDto,
  MetricsDailyDto,
  StatusDistributionDto,
  ByCategoryDto,
  PlanHealthResponseDto,
  ByAgentDto,
  TimeEntryRowDto,
  TicketRowDto,
  MetricRowsParams,
} from '../types/metrics'

/** Remove null/undefined/'' dos params antes de enviar (mesmo padrão do reportsService) */
function cleanParams(params: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== null && v !== undefined && v !== ''),
  )
}

export async function getMetricsOverview(
  params: MetricsBaseParams,
): Promise<MetricsOverviewDto> {
  const { data } = await api.get<MetricsOverviewDto>(
    '/api/v1/metrics/overview',
    { params: cleanParams(params as Record<string, unknown>) },
  )
  return data
}

export async function getMetricsDaily(
  params: MetricsBaseParams,
): Promise<MetricsDailyDto> {
  const { data } = await api.get<MetricsDailyDto>(
    '/api/v1/metrics/daily',
    { params: cleanParams(params as Record<string, unknown>) },
  )
  return data
}

/**
 * GET /metrics/status-distribution.
 * Retorna o corpo HTTP inteiro (`{ byTeam, data }`) — NÃO desempacota `.data`,
 * pois `byTeam` vem no mesmo nível de `data` (contrato §6, união discriminada).
 */
export async function getStatusDistribution(
  params: MetricsBaseParams,
): Promise<StatusDistributionDto> {
  const { data } = await api.get<StatusDistributionDto>(
    '/api/v1/metrics/status-distribution',
    { params: cleanParams(params as Record<string, unknown>) },
  )
  return data
}

export async function getByCategory(
  params: MetricsBaseParams,
): Promise<ByCategoryDto> {
  const { data } = await api.get<ByCategoryDto>(
    '/api/v1/metrics/by-category',
    { params: cleanParams(params as Record<string, unknown>) },
  )
  return data
}

export async function getPlanHealth(
  params: MetricsBaseParams,
): Promise<PlanHealthResponseDto> {
  const { data } = await api.get<PlanHealthResponseDto>(
    '/api/v1/metrics/plan-health',
    { params: cleanParams(params as Record<string, unknown>) },
  )
  return data
}

export async function getByAgent(
  params: MetricsBaseParams,
): Promise<ByAgentDto> {
  const { data } = await api.get<ByAgentDto>(
    '/api/v1/metrics/by-agent',
    { params: cleanParams(params as Record<string, unknown>) },
  )
  return data
}

export type DrillDownParams = MetricsBaseParams & {
  format: 'rows'
  page: number
  pageSize: number
  sortBy?: string | null
  sortDirection?: 'asc' | 'desc'
}

export async function getDrillDownRows(
  params: DrillDownParams,
): Promise<PaginatedResponse<TimeEntryRowDto>> {
  const { data } = await api.get<PaginatedResponse<TimeEntryRowDto>>(
    '/api/v1/metrics/overview',
    { params: cleanParams(params as Record<string, unknown>) },
  )
  return data
}

/**
 * GET /api/v1/metrics/rows — drill-down paramétrico (016).
 * Família TICKET: cada `metric` define o conjunto-raiz de registros que compõem o KPI/série.
 * Os MESMOS filtros/scope/período da tela são repassados (A01 — consistência número↔linhas).
 * Retorna PaginatedResponse<TicketRowDto>.
 */
export async function getMetricRows(
  params: MetricRowsParams,
): Promise<PaginatedResponse<TicketRowDto>> {
  const { data } = await api.get<PaginatedResponse<TicketRowDto>>(
    '/api/v1/metrics/rows',
    { params: cleanParams(params as Record<string, unknown>) },
  )
  return data
}
