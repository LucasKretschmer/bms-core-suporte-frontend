import { useCallback } from 'react'
import { useServerTable } from '../../shared/hooks/useServerTable'
import { listTicketsReport } from '../../shared/services/reportsService'
import type { TableParams } from '../../shared/hooks/useServerTable'
import type { TicketReportItemDto } from '../../shared/types/reports'

export type AppointmentsFilters = {
  scope: 'mine' | 'team' | 'all'
  search: string
  status: string[]
  from: string | null
  to: string | null
}

const INITIAL_FILTERS: AppointmentsFilters = {
  scope: 'mine',
  search: '',
  status: [],
  from: null,
  to: null,
}

/**
 * Hook de tabela server-side para U4 — Apontamentos por Ticket.
 * Gerencia paginação, ordenação e filtros para GET /api/v1/reports/tickets.
 * Inclui todos os tickets — inclusive com totalSeconds = 0.
 */
export function useAppointments() {
  const queryFn = useCallback(
    (params: TableParams<AppointmentsFilters>) =>
      listTicketsReport({
        scope: params.filters.scope,
        search: params.filters.search || undefined,
        status: params.filters.status.length > 0 ? params.filters.status : undefined,
        from: params.filters.from ?? undefined,
        to: params.filters.to ?? undefined,
        sortBy: params.sortBy ?? undefined,
        sortDirection: params.sortDirection,
        page: params.page,
        pageSize: params.pageSize,
      }),
    [],
  )

  return useServerTable<AppointmentsFilters, TicketReportItemDto>({
    queryKey: 'tickets-report',
    queryFn,
    initialFilters: INITIAL_FILTERS,
    initialSortBy: null,
    initialSortDirection: 'desc',
    enabled: true,
  })
}
