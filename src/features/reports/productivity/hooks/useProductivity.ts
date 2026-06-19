import { useServerTable } from '../../shared/hooks/useServerTable'
import { listProductivity } from '../../shared/services/reportsService'
import type { AgentMetricDto } from '../../shared/types/reports'
import type { TableParams } from '../../shared/hooks/useServerTable'

type ProductivityFilters = {
  from: string | null
  to: string | null
  teamId: string | null
}

const initialFilters: ProductivityFilters = {
  from: null,
  to: null,
  teamId: null,
}

/**
 * Hook de tabela server-side para U6 — Produtividade por Analista.
 * Usa useServerTable com queryKey 'productivity'.
 * Restrito a CoordenadorPlus (guarda na rota).
 */
export function useProductivity() {
  return useServerTable<ProductivityFilters, AgentMetricDto>({
    queryKey: 'productivity',
    queryFn: (params: TableParams<ProductivityFilters>) =>
      listProductivity({
        from: params.filters.from,
        to: params.filters.to,
        teamId: params.filters.teamId,
        page: params.page,
        pageSize: params.pageSize,
      }),
    initialFilters,
    initialPageSize: 25,
    enabled: true,
  })
}
