import { api } from '../../../services/api'
import type { PaginatedResponse } from '../../../types/api'
import type {
  PlanConsumptionItemDto,
  TicketReportItemDto,
} from '../../reports/shared/types/reports'

/**
 * Serviços da feature "Tickets do cliente" (F2).
 * Desempacotam o envelope aqui — nunca no componente (R6).
 *
 * - listClientTickets → GET /api/v1/reports/tickets?clientId= (PaginatedResponse cru, B1)
 * - getClientKpis     → GET /api/v1/metrics/plan-consumption (PaginatedResponse cru),
 *                       localizando a linha do cliente pelo clientId.
 */

type ListClientTicketsParams = {
  clientId: number
  search?: string
  status?: string[]
  sortBy?: string | null
  sortDirection?: 'asc' | 'desc'
  page: number
  pageSize: number
}

export async function listClientTickets(
  params: ListClientTicketsParams,
): Promise<PaginatedResponse<TicketReportItemDto>> {
  const { data } = await api.get<PaginatedResponse<TicketReportItemDto>>(
    '/api/v1/reports/tickets',
    { params: cleanParams(params) },
  )
  return data
}

/**
 * Busca os KPIs (consumo de plano) do cliente.
 *
 * O endpoint plan-consumption não filtra por clientId (B1 só adicionou clientId a
 * /reports/tickets), então paginamos a lista e localizamos a linha do cliente.
 * Retorna `null` se o cliente não tiver plano/linha no relatório.
 */
export async function getClientKpis(
  clientId: number,
): Promise<PlanConsumptionItemDto | null> {
  const PAGE_SIZE = 200
  let page = 1

  for (;;) {
    const { data } = await api.get<PaginatedResponse<PlanConsumptionItemDto>>(
      '/api/v1/metrics/plan-consumption',
      { params: { page, pageSize: PAGE_SIZE } },
    )
    const match = data.items.find((item) => item.clientId === clientId)
    if (match) return match
    if (page >= data.totalPages) return null
    page++
  }
}

function cleanParams(params: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== null && v !== undefined && v !== ''),
  )
}
