import { useMemo } from 'react'
import { useServerTable } from '../../shared/hooks/useServerTable'
import { listProductivity } from '../../shared/services/reportsService'
import { defaultCurrentMonthPeriod } from '../../shared/utils/defaultPeriod'
import type { AgentMetricDto } from '../../shared/types/reports'
import type { TableParams } from '../../shared/hooks/useServerTable'

type ProductivityFilters = {
  from: string | null
  to: string | null
  teamId: string | null
}

/**
 * Período padrão = mês corrente (1º dia do mês → hoje), via helper compartilhado (053).
 * Clearable: o usuário pode limpar from/to para null. Calculado na montagem do hook.
 */
function buildInitialFilters(): ProductivityFilters {
  const period = defaultCurrentMonthPeriod()
  return {
    from: period.from,
    to: period.to,
    teamId: null,
  }
}

/**
 * Hook de tabela server-side para U6 — Produtividade por Analista.
 * Usa useServerTable com queryKey 'productivity'.
 * Restrito a CoordenadorPlus (guarda na rota).
 */
export function useProductivity() {
  // useServerTable só usa initialFilters na 1ª render (useState) — memoizar evita
  // recálculo sem resetar o estado já editado pelo usuário.
  const initialFilters = useMemo(buildInitialFilters, [])

  return useServerTable<ProductivityFilters, AgentMetricDto>({
    queryKey: 'productivity',
    queryFn: (params: TableParams<ProductivityFilters>) =>
      listProductivity({
        from: params.filters.from,
        to: params.filters.to,
        teamId: params.filters.teamId,
        // 056: o endpoint passou a aceitar sortBy/sortDirection (antes ordenava fixo
        // por TotalSegundos desc). Front envia exatamente os sortKeys do CONTRATO.
        sortBy: params.sortBy,
        sortDirection: params.sortDirection,
        page: params.page,
        pageSize: params.pageSize,
      }),
    initialFilters,
    initialPageSize: 25,
    // Default = totalsegundos desc — espelha o comportamento histórico do backend.
    initialSortBy: 'totalsegundos',
    initialSortDirection: 'desc',
    enabled: true,
  })
}
