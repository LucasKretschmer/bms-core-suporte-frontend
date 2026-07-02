import { api } from '../../../services/api'
import type { ApiResponse, PaginatedResponse } from '../../../types/api'
import type { TicketScope } from '../../../utils/reportScope'
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
 * - listTicketOwners  → GET /api/v1/reports/tickets/owners (opções do filtro de atendente, 070)
 */

export type ListClientTicketsParams = {
  clientId: number
  /** Default 'all': drill-down é CoordenadorPlus e deve listar TODOS os tickets do cliente. */
  scope?: TicketScope
  search?: string
  status?: string[]
  /** Filtro multi-equipe (array de IDs de equipe). */
  teamId?: number[]
  /** Filtro multi-atendente (array de IDs de usuário/owner interno) — 070. */
  owner?: number[]
  /**
   * Início do período (YYYY-MM-DD) — mesmo formato de listPlanConsumption/reportsService.
   * O backend (GET /api/v1/reports/tickets) já aceita from/to (DateTime?); afeta
   * totalSeconds/apontamentosCount. Vazio/undefined → cleanParams remove (sem filtro).
   */
  from?: string
  /** Fim do período (YYYY-MM-DD). Ver observação em `from`. */
  to?: string
  sortBy?: string | null
  sortDirection?: 'asc' | 'desc'
  page: number
  pageSize: number
}

export async function listClientTickets(
  params: ListClientTicketsParams,
): Promise<PaginatedResponse<TicketReportItemDto>> {
  // Sem scope explícito o backend assume 'mine' (só tickets do owner logado).
  // Aqui forçamos 'all' por default — a tela é CoordenadorPlus e o drill-down
  // precisa de TODOS os chamados do cliente, independente de owner/TimeEntry.
  const { scope = 'all', ...rest } = params
  const { data } = await api.get<PaginatedResponse<TicketReportItemDto>>(
    '/api/v1/reports/tickets',
    { params: cleanParams({ scope, ...rest }) },
  )
  return data
}

/**
 * Opção legível de atendente (owner) para o filtro multi-select (070).
 * value = id interno do usuário (enviado em owner[]); label = nome de exibição.
 */
export type TicketOwnerOption = {
  value: number
  label: string
}

/**
 * Opções de atendente (owner) do filtro de chamados do cliente (070).
 * Envelope ApiResponse<{ value; label }[]> (mesmo padrão de /reports/tickets/statuses).
 */
export async function listTicketOwners(): Promise<TicketOwnerOption[]> {
  const { data } = await api.get<ApiResponse<TicketOwnerOption[]>>(
    '/api/v1/reports/tickets/owners',
  )
  return data.data
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
