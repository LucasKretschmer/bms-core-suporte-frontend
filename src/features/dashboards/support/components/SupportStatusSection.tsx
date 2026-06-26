/**
 * Seção de Distribuição por Status do Dashboard Suporte.
 * Status são dinâmicos (vindos do backend) — sem lista fixa, sem mapeamento de código no FE (#2).
 * União discriminada por `byTeam`: global = barras empilhadas por equipe; equipe = barras por status.
 * AP-SECURITY-001: `status` é status operacional do pipeline, não categoria HubSpot.
 */

import { useStatusDistribution } from '../../shared/hooks/useStatusDistribution'
import { StatusDistributionChart } from '../../shared/components/StatusDistributionChart'
import { ChartCard } from '../../shared/components/ChartCard'
import type { DrillSpec, MetricsScope } from '../../shared/types/metrics'

type SupportStatusSectionProps = {
  scope: MetricsScope
  from: string | null
  to: string | null
  clientId?: string | null
  planId?: string | null
  /**
   * Drill (016/020): clique numa barra de status → tabela dos tickets do grupo (statusKey).
   * O backend resolve os stageIds membros (A01).
   */
  onStatusDrill?: (spec: DrillSpec) => void
}

export function SupportStatusSection({
  scope,
  from,
  to,
  clientId,
  planId,
  onStatusDrill,
}: SupportStatusSectionProps) {
  const { data: dist, isLoading, isError, refetch } = useStatusDistribution({
    scope,
    from,
    to,
    clientId,
    supportPlanId: planId,
  })

  // Discriminar pela união: global vazio também quando todas as equipes têm porStatus vazio.
  const isEmpty =
    !isLoading &&
    !isError &&
    (!dist ||
      dist.data.length === 0 ||
      (dist.byTeam && dist.data.every((team) => team.porStatus.length === 0)))

  // Título reflete o escopo: global mostra a matriz equipe × status; equipe mostra o
  // somatório por status agrupado (020 — não é mais "por etapa").
  const title = dist?.byTeam ? 'Status por Equipe' : 'Status em Aberto'

  return (
    <ChartCard
      title={title}
      isLoading={isLoading}
      isError={isError}
      isEmpty={isEmpty}
      emptyMessage="Sem dados de status para o período."
      onRetry={refetch}
      height={260}
    >
      {dist && (
        <StatusDistributionChart
          data={dist}
          height={260}
          onSliceClick={
            onStatusDrill
              ? (statusKey, status) =>
                  onStatusDrill({
                    metric: 'tickets-backlog',
                    title: `Tickets — ${status}`,
                    params: { statusKey },
                  })
              : undefined
          }
        />
      )}
    </ChartCard>
  )
}
