import type { TicketsReportParams } from '../shared/services/reportsService'
import type { AppointmentsFilters } from './hooks/useAppointments'

type TicketsReportSort = {
  sortBy: string | null
  sortDirection: 'asc' | 'desc'
}

type TicketsReportPagination = {
  page: number
  pageSize: number
}

function arrayOrUndefined<T>(values: T[]): T[] | undefined {
  return values.length > 0 ? values : undefined
}

/**
 * Fonte única dos params de GET /reports/tickets desta tela: a lista e a exportação
 * chamam esta função, então a planilha sempre responde à mesma pergunta da tabela.
 */
export function buildTicketsReportParams(
  filters: AppointmentsFilters,
  sort: TicketsReportSort,
  pagination: TicketsReportPagination,
): TicketsReportParams {
  return {
    scope: filters.scope,
    search: filters.search || undefined,
    status: arrayOrUndefined(filters.status),
    teamId: arrayOrUndefined(filters.teamId),
    categoria: arrayOrUndefined(filters.categoria),
    serviceCategoryId: arrayOrUndefined(filters.serviceCategoryId),
    // Toggle ligado = sem recorte: o param não vai ao wire e o backend lista todos.
    somenteComApontamento: filters.incluirSemApontamento ? undefined : true,
    from: filters.from ?? undefined,
    to: filters.to ?? undefined,
    sortBy: sort.sortBy ?? undefined,
    sortDirection: sort.sortDirection,
    page: pagination.page,
    pageSize: pagination.pageSize,
  }
}
