/**
 * Seção de Saúde dos Planos do Dashboard Suporte.
 * Sempre scope=global — ignora filtro de equipe.
 * Gráfico de barras (verde/amarelo/vermelho).
 * AP-SECURITY-001: labels "< 80% (ok)", "80–95% (atenção)", "≥ 95% (crítico)" — sem categoria HubSpot.
 */

import { usePlanHealth } from '../../shared/hooks/usePlanHealth'
import { PlanHealthChart } from '../../shared/components/PlanHealthChart'
import { ChartCard } from '../../shared/components/ChartCard'

type SupportPlanHealthSectionProps = {
  from: string | null
  to: string | null
  clientId?: string | null
  planId?: string | null
}

export function SupportPlanHealthSection({
  from,
  to,
  clientId,
  planId,
}: SupportPlanHealthSectionProps) {
  // Saúde de planos é SEMPRE global — não filtra por equipe (conforme análise §8.2)
  const { data, isLoading, isError, refetch } = usePlanHealth({
    scope: 'global',
    from,
    to,
    clientId,
    supportPlanId: planId,
  })

  const summary = data?.summary ?? null
  const isEmpty = !isLoading && !isError && !summary

  return (
    <ChartCard
      title="Saúde dos Planos"
      isLoading={isLoading}
      isError={isError}
      isEmpty={isEmpty}
      emptyMessage="Sem dados de planos para o período."
      onRetry={refetch}
      height={220}
    >
      <PlanHealthChart summary={summary} height={220} />
    </ChartCard>
  )
}
