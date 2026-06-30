import { useMemo } from 'react'
import { useServerTable } from '../../shared/hooks/useServerTable'
import { listPlanConsumption } from '../../shared/services/reportsService'
import { defaultCurrentMonthPeriod } from '../../shared/utils/defaultPeriod'
import type { PlanConsumptionItemDto } from '../../shared/types/reports'
import type { TableParams } from '../../shared/hooks/useServerTable'

type PlanConsumptionFilters = {
  search: string
  planId: string | null
  from: string | null
  to: string | null
}

/**
 * Filtros iniciais — período default = mês corrente (clearable), via helper compartilhado (053).
 * O backend já assume o mês corrente quando from/to vêm nulos; preencher no front
 * deixa o período visível ao usuário sem torná-lo obrigatório.
 */
function buildInitialFilters(): PlanConsumptionFilters {
  const period = defaultCurrentMonthPeriod()
  return {
    search: '',
    planId: null,
    from: period.from,
    to: period.to,
  }
}

/**
 * Hook de tabela server-side para U3 — Consumo de Planos.
 * Usa useServerTable com queryKey 'plan-consumption'.
 * enabled=true sempre (não requer filtros obrigatórios).
 */
export function usePlanConsumption() {
  // useServerTable só usa initialFilters na 1ª render — memoizar mantém referência estável.
  const initialFilters = useMemo(buildInitialFilters, [])

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
