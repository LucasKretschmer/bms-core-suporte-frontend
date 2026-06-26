/**
 * Seção de Movimentação Diária do Dashboard Suporte.
 * Gráfico de linha com 5 séries (novos, andamento, resolvidos, cancelados, aberto).
 * AP-SECURITY-001: labels são constantes PT-BR, nunca categorias HubSpot.
 */

import { useMetricsDaily } from '../../shared/hooks/useMetricsDaily'
import { LineChartMovimentacao } from '../../shared/components/LineChartMovimentacao'
import { ChartCard } from '../../shared/components/ChartCard'
import { isMovimentacaoEmpty } from '../../shared/utils/movimentacao'
import type { MetricsScope } from '../../shared/types/metrics'

type SupportMovimentacaoSectionProps = {
  scope: MetricsScope
  from: string | null
  to: string | null
  clientId?: string | null
  planId?: string | null
}

export function SupportMovimentacaoSection({
  scope,
  from,
  to,
  clientId,
  planId,
}: SupportMovimentacaoSectionProps) {
  const { data, isLoading, isError, refetch } = useMetricsDaily({
    scope,
    from,
    to,
    clientId,
    supportPlanId: planId,
  })

  const days = data?.days ?? []
  // Empty honesto (#1): sem dias OU dias retornados com todas as séries em zero.
  // Não fingir "erro" quando simplesmente não houve movimentação no período.
  const isEmpty = isMovimentacaoEmpty(days, isLoading, isError)

  return (
    <ChartCard
      title="Movimentação Diária"
      isLoading={isLoading}
      isError={isError}
      isEmpty={isEmpty}
      emptyMessage="Sem movimentação registrada no período."
      onRetry={refetch}
      height={260}
    >
      <LineChartMovimentacao data={days} height={260} />
    </ChartCard>
  )
}
