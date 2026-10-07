import { useQuery } from '@tanstack/react-query'
import { getProductivitySummary } from '../../shared/services/reportsService'
import type { ProductivitySummaryParams } from '../../shared/services/reportsService'
import type { ProductivitySummaryDto } from '../../shared/types/reports'

export const productivitySummaryKeys = {
  all: ['productivity-summary'] as const,
  detail: (params: ProductivitySummaryParams) =>
    [
      ...productivitySummaryKeys.all,
      params.from ?? null,
      params.to ?? null,
      params.teamId ?? null,
      params.userId ?? null,
    ] as const,
}

/** Resumo de produtividade do recorte; com `userId`, só daquele atendente. */
export function useProductivitySummary(params: ProductivitySummaryParams) {
  return useQuery<ProductivitySummaryDto>({
    queryKey: productivitySummaryKeys.detail(params),
    queryFn: () => getProductivitySummary(params),
  })
}
