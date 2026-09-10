import { useServerTable } from '../../reports/shared/hooks/useServerTable'
import { listBillingPeriodComparison } from '../services/billingPeriodsService'
import type { BillingPeriodComparisonItemDto } from '../types/billingPeriod'

/** Ver a nota de `BILLING_PERIODS_QUERY_KEY` — mesma razão, mesma trava nominal. */
export const BILLING_PERIOD_COMPARISON_QUERY_KEY = 'billing-period-comparison'

export type ComparacaoFilters = {
  /**
   * `"YYYY-MM"`. Vive nos **filtros** (e não só no fecho da `queryFn`) porque o
   * `useServerTable` monta a `queryKey` a partir deles: fora da chave, duas competências
   * compartilhariam o mesmo cache e a tela mostraria a comparação do mês anterior sem
   * erro nenhum.
   */
  competencia: string
  /** Filtro opcional por cliente — `null` = todos. */
  clientId: string | null
}

/**
 * A comparação de auditoria (D12 · `arquitetura.md` §8.2), paginada e filtrável por
 * cliente.
 *
 * ⚠️ O hook assume que a competência **não muda durante a vida do componente**: quem o
 * usa monta a seção com `key={competencia}`, de modo que trocar de mês remonta a árvore
 * com paginação e filtro zerados. É de propósito — sincronizar `initialFilters` por
 * efeito deixaria, por um render, a `queryKey` com o mês antigo e dispararia uma
 * requisição para a competência errada antes de corrigir.
 */
export function useBillingPeriodComparison(competencia: string) {
  return useServerTable<ComparacaoFilters, BillingPeriodComparisonItemDto>({
    queryKey: BILLING_PERIOD_COMPARISON_QUERY_KEY,
    queryFn: ({ page, pageSize, filters }) =>
      listBillingPeriodComparison({
        competencia: filters.competencia,
        clientId: filters.clientId == null ? null : Number(filters.clientId),
        page,
        pageSize,
      }),
    initialFilters: { competencia, clientId: null },
    initialPageSize: 25,
  })
}
