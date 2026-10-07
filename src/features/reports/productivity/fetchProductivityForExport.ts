import { listProductivity } from '../shared/services/reportsService'
import { fetchAllPaginated } from '../shared/utils/fetchAllPaginated'
import type { SortState } from '../../../components/ui/DataTable/types'
import type { ProductivityReportItemDto } from '../shared/types/reports'
import type { ProductivityFilters } from './hooks/useProductivity'

/** Todas as páginas do recorte da tela, na mesma ordenação da tela. */
export function fetchProductivityForExport(
  filters: ProductivityFilters,
  sort: SortState,
): Promise<ProductivityReportItemDto[]> {
  return fetchAllPaginated<ProductivityReportItemDto>((page, pageSize) =>
    listProductivity({
      from: filters.from,
      to: filters.to,
      teamId: filters.teamId,
      sortBy: sort.sortBy,
      sortDirection: sort.sortDirection,
      page,
      pageSize,
    }),
  )
}
