import { useServerTable } from '../../shared/hooks/useServerTable'
import { listAppointmentsReport } from '../../shared/services/reportsService'
import type { TableParams } from '../../shared/hooks/useServerTable'
import type { AppointmentReportItemDto } from '../../shared/types/reports'

export type ProductivityAppointmentsFilters = {
  userId: number
  from: string | null
  to: string | null
}

/** Apontamentos do analista no período, do maior para o menor por padrão. */
export function useProductivityAppointments(filters: ProductivityAppointmentsFilters) {
  return useServerTable<ProductivityAppointmentsFilters, AppointmentReportItemDto>({
    queryKey: 'productivity-appointments',
    queryFn: (params: TableParams<ProductivityAppointmentsFilters>) =>
      listAppointmentsReport({
        userId: params.filters.userId,
        from: params.filters.from,
        to: params.filters.to,
        sortBy: params.sortBy,
        sortDirection: params.sortDirection,
        page: params.page,
        pageSize: params.pageSize,
      }),
    initialFilters: filters,
    initialPageSize: 25,
    initialSortBy: 'totalsegundos',
    initialSortDirection: 'desc',
  })
}
