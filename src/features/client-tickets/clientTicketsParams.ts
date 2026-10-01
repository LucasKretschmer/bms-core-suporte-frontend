import { resolverPeriodoPadrao } from '../reports/shared/utils/periodoPadrao'
import type { TicketScope } from '../../utils/reportScope'
import type { ListClientTicketsParams } from './services/clientTicketsService'
import type { ClientTicketsFilters } from './hooks/useClientTickets'

/**
 * Escopo do detalhe do cliente: visão de coordenação, todos os chamados do cliente.
 * A tabela e o combo "Atendente" usam o mesmo valor para listar o mesmo universo.
 */
export const CLIENT_TICKETS_SCOPE: TicketScope = 'all'

type ClientTicketsSort = {
  sortBy: string | null
  sortDirection: 'asc' | 'desc'
}

type ClientTicketsPagination = {
  page: number
  pageSize: number
}

function arrayOrUndefined<T>(values: T[]): T[] | undefined {
  return values.length > 0 ? values : undefined
}

/**
 * Fonte única dos params de GET /reports/tickets do detalhe do cliente, usada pela
 * tabela e pela exportação.
 */
export function buildClientTicketsParams(
  clientId: number,
  filters: ClientTicketsFilters,
  sort: ClientTicketsSort,
  pagination: ClientTicketsPagination,
): ListClientTicketsParams {
  // Mesma janela dos KPIs, sempre explícita: campo em branco vale o mês atual (D-2).
  const periodo = resolverPeriodoPadrao({ from: filters.from, to: filters.to })

  return {
    clientId,
    scope: CLIENT_TICKETS_SCOPE,
    search: filters.search || undefined,
    status: arrayOrUndefined(filters.status),
    teamId: arrayOrUndefined(filters.teamId),
    apontadoPor: arrayOrUndefined(filters.apontadoPor),
    somenteComApontamento: true,
    from: periodo.from,
    to: periodo.to,
    // Só vai ao wire quando ligado: false é o default do controller.
    apenasFatura: filters.apenasFatura || undefined,
    sortBy: sort.sortBy ?? undefined,
    sortDirection: sort.sortDirection,
    page: pagination.page,
    pageSize: pagination.pageSize,
  }
}
