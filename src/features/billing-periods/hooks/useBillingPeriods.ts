import { useServerTable } from '../../reports/shared/hooks/useServerTable'
import { listBillingPeriods } from '../services/billingPeriodsService'
import type { BillingPeriodDto } from '../types/billingPeriod'

/**
 * Prefixo da `queryKey` da listagem de competências.
 *
 * ⚠️ Exportado, e usado tanto aqui quanto na invalidação das mutations: o `useServerTable`
 * monta o array `[prefixo, page, pageSize, sortBy, sortDirection, filters]` lá dentro, e o
 * casamento do TanStack Query é por **prefixo**. Duas strings iguais escritas em dois
 * arquivos divergem em silêncio no dia em que uma delas mudar.
 *
 * Esta chave está registrada nominalmente em `NAO_RESOLVIDAS_ACEITAS`
 * (`features/support-plans/utils/queryKeyRegistry.test.ts`) — o inventário de queries do
 * repo é derivado da AST e não resolve o prefixo dentro do wrapper.
 */
export const BILLING_PERIODS_QUERY_KEY = 'billing-periods'

/** A listagem não tem filtro próprio (a janela de meses é decidida pelo servidor). */
type SemFiltros = Record<string, never>

export function useBillingPeriods() {
  return useServerTable<SemFiltros, BillingPeriodDto>({
    queryKey: BILLING_PERIODS_QUERY_KEY,
    queryFn: ({ page, pageSize }) => listBillingPeriods({ page, pageSize }),
    initialFilters: {},
    initialPageSize: 25,
  })
}
