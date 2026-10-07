import { useState } from 'react'
import { useServerTable } from '../../shared/hooks/useServerTable'
import { listProductivity } from '../../shared/services/reportsService'
import { defaultCurrentMonthPeriod } from '../../shared/utils/defaultPeriod'
import type { ProductivityReportItemDto } from '../../shared/types/reports'
import type { TableParams } from '../../shared/hooks/useServerTable'

export type ProductivityFilters = {
  from: string | null
  to: string | null
  teamId: string | null
}

/** Período padrão = mês corrente (1º dia até hoje); o usuário pode limpar. */
function buildInitialFilters(): ProductivityFilters {
  const period = defaultCurrentMonthPeriod()
  return {
    from: period.from,
    to: period.to,
    teamId: null,
  }
}

/** Tabela server-side da Produtividade por Analista (rota restrita a CoordenadorPlus). */
export function useProductivity() {
  // Calculado só na montagem: useServerTable lê initialFilters uma vez.
  const [initialFilters] = useState(buildInitialFilters)

  return useServerTable<ProductivityFilters, ProductivityReportItemDto>({
    queryKey: 'productivity',
    queryFn: (params: TableParams<ProductivityFilters>) =>
      listProductivity({
        from: params.filters.from,
        to: params.filters.to,
        teamId: params.filters.teamId,
        sortBy: params.sortBy,
        sortDirection: params.sortDirection,
        page: params.page,
        pageSize: params.pageSize,
      }),
    initialFilters,
    initialPageSize: 25,
    initialSortBy: 'totalsegundos',
    initialSortDirection: 'desc',
    enabled: true,
  })
}
