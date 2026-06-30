import { useCallback, useMemo } from 'react'
import { useServerTable } from '../../shared/hooks/useServerTable'
import { listProjectAppointments } from '../../shared/services/reportsService'
import { usePermissions } from '../../../../hooks/usePermissions'
import { defaultTicketScope, type TicketScope } from '../../../../utils/reportScope'
import { defaultCurrentMonthPeriod } from '../../shared/utils/defaultPeriod'
import type { TableParams } from '../../shared/hooks/useServerTable'
import type { ProjectAppointmentReportItemDto } from '../../shared/types/reports'

export type ProjectAppointmentsFilters = {
  scope: TicketScope
  search: string
  teamId: number[]
  clientId: string | null
  from: string | null
  to: string | null
}

/**
 * Período default: do 1º dia do mês corrente até hoje (formato YYYY-MM-DD).
 * Reusa o helper compartilhado `defaultCurrentMonthPeriod` (053). Clearable.
 */
export function defaultProjectAppointmentsPeriod(reference: Date = new Date()): {
  from: string
  to: string
} {
  return defaultCurrentMonthPeriod(reference)
}

/**
 * Hook de tabela server-side para 057 — Apontamentos por Projeto.
 * Gerencia paginação, ordenação e filtros para GET /api/v1/reports/project-appointments.
 *
 * Scope default por papel (espelha appointments): Coordenador+ → 'all'; Atendente → 'mine'.
 * UX apenas — o backend força 'mine' p/ Atendente (A01), é a fonte de verdade.
 */
export function useProjectAppointments() {
  const { isCoordenadorOuAcima } = usePermissions()

  const initialFilters = useMemo<ProjectAppointmentsFilters>(() => {
    const period = defaultCurrentMonthPeriod()
    return {
      scope: defaultTicketScope(isCoordenadorOuAcima),
      search: '',
      teamId: [],
      clientId: null,
      from: period.from,
      to: period.to,
    }
  }, [isCoordenadorOuAcima])

  const queryFn = useCallback(
    (params: TableParams<ProjectAppointmentsFilters>) =>
      listProjectAppointments({
        scope: params.filters.scope,
        search: params.filters.search || undefined,
        teamId: params.filters.teamId.length > 0 ? params.filters.teamId : undefined,
        clientId: params.filters.clientId ?? undefined,
        from: params.filters.from ?? undefined,
        to: params.filters.to ?? undefined,
        sortBy: params.sortBy ?? undefined,
        sortDirection: params.sortDirection,
        page: params.page,
        pageSize: params.pageSize,
      }),
    [],
  )

  return useServerTable<ProjectAppointmentsFilters, ProjectAppointmentReportItemDto>({
    queryKey: 'project-appointments-report',
    queryFn,
    initialFilters,
    initialSortBy: null,
    initialSortDirection: 'desc',
    enabled: true,
  })
}
