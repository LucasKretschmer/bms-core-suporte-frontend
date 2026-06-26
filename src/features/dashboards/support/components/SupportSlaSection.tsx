/**
 * Seção de 1ª Resposta vs SLA do Dashboard Suporte.
 * Derivada dos campos respondidosNoPrazo / respondidosForaDoPrazo do MetricsOverviewDto.
 * Recebe valores prontos — sem chamada própria de API.
 * AP-SECURITY-001: labels "Respondidos no prazo" / "Respondidos fora do prazo" — sem categoria HubSpot.
 */

import { FirstResponseVsSlaChart } from '../../shared/components/FirstResponseVsSlaChart'
import { ChartCard } from '../../shared/components/ChartCard'
import type { DrillSpec } from '../../shared/types/metrics'

type SupportSlaSectionProps = {
  respondidosNoPrazo: number | null
  respondidosForaDoPrazo: number | null
  isLoading?: boolean
  isError?: boolean
  onRetry?: () => void
  /** Drill (016): clique na fatia → tabela dos tickets daquele balde de SLA. */
  onSegmentDrill?: (spec: DrillSpec) => void
}

export function SupportSlaSection({
  respondidosNoPrazo,
  respondidosForaDoPrazo,
  isLoading = false,
  isError = false,
  onRetry,
  onSegmentDrill,
}: SupportSlaSectionProps) {
  // Empty honesto e conservador (#5): dado de SLA depende de configuração no
  // Service Hub. Se QUALQUER um dos lados vier null, não há base confiável para
  // o gráfico — usar `?? 0` mostraria "zero respostas" enganosamente. Por isso
  // o empty dispara se ambos OU apenas um forem null (estado parcial).
  const isEmpty =
    !isLoading &&
    !isError &&
    (respondidosNoPrazo === null || respondidosForaDoPrazo === null)

  return (
    <ChartCard
      title="1ª Resposta vs SLA"
      isLoading={isLoading}
      isError={isError}
      isEmpty={isEmpty}
      emptyMessage="Dados de SLA não disponíveis. Requer configuração no Service Hub."
      onRetry={onRetry}
      height={220}
    >
      <FirstResponseVsSlaChart
        respondidosNoPrazo={respondidosNoPrazo}
        respondidosForaDoPrazo={respondidosForaDoPrazo}
        height={220}
        onSegmentClick={
          onSegmentDrill
            ? (sla) =>
                onSegmentDrill({
                  metric: 'tickets-sla',
                  title:
                    sla === 'on'
                      ? 'Respondidos no prazo (SLA)'
                      : 'Respondidos fora do prazo',
                  params: { sla },
                })
            : undefined
        }
      />
    </ChartCard>
  )
}
