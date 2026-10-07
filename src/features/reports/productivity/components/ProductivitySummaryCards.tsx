import { ErrorState } from '../../../../components/ui/ErrorState'
import { KpiCard } from '../../../dashboards/shared/components/KpiCard'
import { KpiCardGrid } from '../../../dashboards/shared/components/KpiCardGrid'
import { useProductivitySummary } from '../hooks/useProductivitySummary'
import { buildSummaryCards } from '../summaryCards'
import type { ProductivitySummaryParams } from '../../shared/services/reportsService'
import type { SummaryCardVariant } from '../summaryCards'

type ProductivitySummaryCardsProps = {
  params: ProductivitySummaryParams
  variant: SummaryCardVariant
  ariaLabel: string
}

export function ProductivitySummaryCards({
  params,
  variant,
  ariaLabel,
}: ProductivitySummaryCardsProps) {
  const { data, isLoading, isError, refetch } = useProductivitySummary(params)

  return (
    <section aria-label={ariaLabel}>
      {isError ? (
        <ErrorState
          message="Não foi possível carregar o resumo de produtividade."
          onRetry={() => void refetch()}
        />
      ) : (
        <KpiCardGrid>
          {buildSummaryCards(data, variant).map((card) => (
            <KpiCard
              key={card.label}
              label={card.label}
              value={card.value}
              isLoading={isLoading}
            />
          ))}
        </KpiCardGrid>
      )}
    </section>
  )
}
