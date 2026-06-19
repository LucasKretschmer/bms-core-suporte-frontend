import { useServerTable } from '../../shared/hooks/useServerTable'
import { listPlanConsumption } from '../../shared/services/reportsService'
import type { PlanConsumptionItemDto } from '../../shared/types/reports'
import type { TableParams } from '../../shared/hooks/useServerTable'

type PlanConsumptionFilters = {
  search: string
  planId: string | null
  from: string | null
  to: string | null
}

const initialFilters: PlanConsumptionFilters = {
  search: '',
  planId: null,
  from: null,
  to: null,
}

/**
 * Hook de tabela server-side para U3 — Consumo de Planos.
 * Usa useServerTable com queryKey 'plan-consumption'.
 * enabled=true sempre (não requer filtros obrigatórios).
 */
export function usePlanConsumption() {
  return useServerTable<PlanConsumptionFilters, PlanConsumptionItemDto>({
    queryKey: 'plan-consumption',
    queryFn: (params: TableParams<PlanConsumptionFilters>) =>
      listPlanConsumption({
        search: params.filters.search || undefined,
        planId: params.filters.planId,
        from: params.filters.from,
        to: params.filters.to,
        sortBy: params.sortBy,
        sortDirection: params.sortDirection,
        page: params.page,
        pageSize: params.pageSize,
      }),
    initialFilters,
    initialPageSize: 25,
    enabled: true,
  })
}
