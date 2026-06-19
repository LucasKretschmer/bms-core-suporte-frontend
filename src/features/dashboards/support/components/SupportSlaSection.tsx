/**
 * Seção de 1ª Resposta vs SLA do Dashboard Suporte.
 * Derivada dos campos respondidosNoPrazo / respondidosForaDoPrazo do MetricsOverviewDto.
 * Recebe valores prontos — sem chamada própria de API.
 * AP-SECURITY-001: labels "Respondidos no prazo" / "Respondidos fora do prazo" — sem categoria HubSpot.
 */

import { FirstResponseVsSlaChart } from '../../shared/components/FirstResponseVsSlaChart'
import { ChartCard } from '../../shared/components/ChartCard'

type SupportSlaSectionProps = {
  respondidosNoPrazo: number | null
  respondidosForaDoPrazo: number | null
  isLoading?: boolean
  isError?: boolean
  onRetry?: () => void
}

export function SupportSlaSection({
  respondidosNoPrazo,
  respondidosForaDoPrazo,
  isLoading = false,
  isError = false,
  onRetry,
}: SupportSlaSectionProps) {
  const isEmpty =
    !isLoading &&
    !isError &&
    respondidosNoPrazo === null &&
    respondidosForaDoPrazo === null

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
      />
    </ChartCard>
  )
}
