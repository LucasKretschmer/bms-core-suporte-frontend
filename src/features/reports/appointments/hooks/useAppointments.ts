import { useCallback, useMemo } from 'react'
import { format, startOfMonth } from 'date-fns'
import { useServerTable } from '../../shared/hooks/useServerTable'
import { listTicketsReport } from '../../shared/services/reportsService'
import { usePermissions } from '../../../../hooks/usePermissions'
import { defaultTicketScope, type TicketScope } from '../../../../utils/reportScope'
import type { TableParams } from '../../shared/hooks/useServerTable'
import type { TicketReportItemDto } from '../../shared/types/reports'

export type AppointmentsFilters = {
  scope: TicketScope
  search: string
  status: string[]
  teamId: number[]
  from: string | null
  to: string | null
}

/** Período default: do 1º dia do mês corrente até hoje (formato YYYY-MM-DD, igual ao PeriodFilter). */
export function defaultAppointmentsPeriod(reference: Date = new Date()): {
  from: string
  to: string
} {
  return {
    from: format(startOfMonth(reference), 'yyyy-MM-dd'),
    to: format(reference, 'yyyy-MM-dd'),
  }
}

/**
 * Hook de tabela server-side para U4 — Apontamentos por Ticket.
 * Gerencia paginação, ordenação e filtros para GET /api/v1/reports/tickets.
 * Inclui todos os tickets — inclusive com totalSeconds = 0.
 *
 * Scope default por papel (#9): Coordenador+ → 'all'; Atendente → 'mine'.
 * UX apenas — o backend força 'mine' p/ Atendente (A01), é a fonte de verdade.
 */
export function useAppointments() {
  const { isCoordenadorOuAcima } = usePermissions()

  // Memoizado por papel: useServerTable só usa initialFilters na 1ª render,
  // mas mantemos referência estável para evitar reset acidental.
  const initialFilters = useMemo<AppointmentsFilters>(() => {
    const period = defaultAppointmentsPeriod()
    return {
      scope: defaultTicketScope(isCoordenadorOuAcima),
      search: '',
      status: [],
      teamId: [],
      from: period.from,
      to: period.to,
    }
  }, [isCoordenadorOuAcima])

  const queryFn = useCallback(
    (params: TableParams<AppointmentsFilters>) =>
      listTicketsReport({
        scope: params.filters.scope,
        search: params.filters.search || undefined,
        status: params.filters.status.length > 0 ? params.filters.status : undefined,
        teamId: params.filters.teamId.length > 0 ? params.filters.teamId : undefined,
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
    initialFilters,
    initialSortBy: null,
    initialSortDirection: 'desc',
    enabled: true,
  })
}
