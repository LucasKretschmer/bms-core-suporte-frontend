import { useMemo } from 'react'
import { format, startOfMonth } from 'date-fns'
import { useServerTable } from '../../shared/hooks/useServerTable'
import { listProductivity } from '../../shared/services/reportsService'
import type { AgentMetricDto } from '../../shared/types/reports'
import type { TableParams } from '../../shared/hooks/useServerTable'

type ProductivityFilters = {
  from: string | null
  to: string | null
  teamId: string | null
}

/**
 * Período padrão = mês corrente (1º dia do mês → hoje).
 * Calculado no momento da montagem do hook (1º acesso) — reflete o relógio atual.
 * format(date, 'yyyy-MM-dd') usa o fuso local — nunca toISOString (evita off-by-one).
 */
function buildInitialFilters(): ProductivityFilters {
  const now = new Date()
  return {
    from: format(startOfMonth(now), 'yyyy-MM-dd'),
    to: format(now, 'yyyy-MM-dd'),
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
        page: params.page,
        pageSize: params.pageSize,
      }),
    initialFilters,
    initialPageSize: 25,
    enabled: true,
  })
}
