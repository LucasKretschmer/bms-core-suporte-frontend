/**
 * Serviço da tela de logs de Movimentação Diária (021).
 * Usa a instância `api` central — nunca axios direto.
 * Desempacotamento do envelope feito aqui; componentes nunca tocam no envelope.
 *
 * Endpoint: GET /api/v1/metrics/movimentacao-diaria
 *   → PaginatedResponse<MovimentacaoDiariaRowDto>
 *
 * Filtros/ordenação/paginação seguem rules/api.md. O backend aplica scope/A01,
 * whitelist de sortBy (data|quantidade|equipe|atualizadoem) e cap de pageSize (200).
 */

import { api } from '../../../services/api'
import type { PaginatedResponse } from '../../../types/api'
import type { MetricsScope } from '../../dashboards/shared/types/metrics'
import type { MovimentacaoDiariaRowDto, StatusBucket } from '../types/movimentacaoDiaria'

export type MovimentacaoDiariaParams = {
  scope?: MetricsScope
  from?: string | null
  to?: string | null
  /** Filtro multi-seleção por bucket. Enviado como statusBucket[]. */
  statusBucket?: StatusBucket[]
  equipeId?: number | null
  search?: string | null
  sortBy?: string | null
  sortDirection?: 'asc' | 'desc'
  page: number
  pageSize: number
}

export async function listMovimentacaoDiaria(
  params: MovimentacaoDiariaParams,
): Promise<PaginatedResponse<MovimentacaoDiariaRowDto>> {
  const { data } = await api.get<PaginatedResponse<MovimentacaoDiariaRowDto>>(
    '/api/v1/metrics/movimentacao-diaria',
    { params: cleanParams(params) },
  )
  return data
}

/**
 * Remove null/undefined/'' e arrays vazios antes de enviar.
 * Mesmo padrão dos demais services; arrays vazios não vão na query string.
 */
function cleanParams(params: MovimentacaoDiariaParams): Record<string, unknown> {
  const entries = Object.entries(params).filter(([, v]) => {
    if (v === null || v === undefined || v === '') return false
    if (Array.isArray(v) && v.length === 0) return false
    return true
  })
  return Object.fromEntries(entries)
}
