/**
 * Seção de Distribuição por Status do Dashboard Suporte.
 * Status são dinâmicos (vindos do backend) — sem lista fixa.
 * AP-SECURITY-001: pipelineStage é status operacional, não categoria HubSpot.
 */

import { useStatusDistribution } from '../../shared/hooks/useStatusDistribution'
import { StatusDistributionChart } from '../../shared/components/StatusDistributionChart'
import { ChartCard } from '../../shared/components/ChartCard'
import type { MetricsScope } from '../../shared/types/metrics'

type SupportStatusSectionProps = {
  scope: MetricsScope
  from: string | null
  to: string | null
  clientId?: string | null
  planId?: string | null
}

export function SupportStatusSection({
  scope,
  from,
  to,
  clientId,
  planId,
}: SupportStatusSectionProps) {
  const { data, isLoading, isError, refetch } = useStatusDistribution({
    scope,
    from,
    to,
    clientId,
    supportPlanId: planId,
  })

  const items = data?.data ?? []
  const isEmpty = !isLoading && !isError && items.length === 0

  return (
    <ChartCard
      title="Status em Aberto (por etapa)"
      isLoading={isLoading}
      isError={isError}
      isEmpty={isEmpty}
      emptyMessage="Sem dados de status para o período."
      onRetry={refetch}
      height={260}
    >
      <StatusDistributionChart data={items} height={260} />
    </ChartCard>
  )
}
