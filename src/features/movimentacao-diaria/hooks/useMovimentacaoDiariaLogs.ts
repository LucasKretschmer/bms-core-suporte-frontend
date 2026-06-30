/**
 * Hook de tabela server-side para a tela de logs de Movimentação Diária (021).
 * Reusa o useServerTable genérico (page/pageSize/sortBy/sortDirection/filters na queryKey).
 *
 * Scope: a tela é CoordenadorPlus (mesma policy do endpoint). Filtro por equipe
 * monta o scope `team:{id}`; sem equipe selecionada usa `global`. O backend é a
 * fonte de verdade do scope/A01 — aqui é só UX.
 */

import { useCallback, useMemo } from 'react'
import { useServerTable } from '../../reports/shared/hooks/useServerTable'
import type { TableParams } from '../../reports/shared/hooks/useServerTable'
import { defaultCurrentMonthPeriod } from '../../reports/shared/utils/defaultPeriod'
import { listMovimentacaoDiaria } from '../services/movimentacaoDiariaService'
import type { MovimentacaoDiariaRowDto, StatusBucket } from '../types/movimentacaoDiaria'
import type { MetricsScope } from '../../dashboards/shared/types/metrics'

export type MovimentacaoDiariaFilters = {
  /** ID interno da equipe selecionada; null = todas (scope global). */
  equipeId: number | null
  statusBucket: StatusBucket[]
  search: string
  from: string | null
  to: string | null
}

/** Monta o scope de métricas a partir da equipe selecionada. */
export function buildScope(equipeId: number | null): MetricsScope {
  return equipeId === null ? 'global' : `team:${equipeId}`
}

/**
 * Filtros iniciais — período default = mês corrente (clearable), via helper compartilhado (053).
 */
function buildInitialFilters(): MovimentacaoDiariaFilters {
  const period = defaultCurrentMonthPeriod()
  return {
    equipeId: null,
    statusBucket: [],
    search: '',
    from: period.from,
    to: period.to,
  }
}

export function useMovimentacaoDiariaLogs() {
  const initialFilters = useMemo<MovimentacaoDiariaFilters>(buildInitialFilters, [])

  const queryFn = useCallback(
    (params: TableParams<MovimentacaoDiariaFilters>) =>
      listMovimentacaoDiaria({
        scope: buildScope(params.filters.equipeId),
        from: params.filters.from ?? undefined,
        to: params.filters.to ?? undefined,
        statusBucket:
          params.filters.statusBucket.length > 0 ? params.filters.statusBucket : undefined,
        search: params.filters.search || undefined,
        sortBy: params.sortBy ?? undefined,
        sortDirection: params.sortDirection,
        page: params.page,
        pageSize: params.pageSize,
      }),
    [],
  )

  return useServerTable<MovimentacaoDiariaFilters, MovimentacaoDiariaRowDto>({
    queryKey: 'movimentacao-diaria-logs',
    queryFn,
    initialFilters,
    initialSortBy: 'data',
    initialSortDirection: 'desc',
    enabled: true,
  })
}
