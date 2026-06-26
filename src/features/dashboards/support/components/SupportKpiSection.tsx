/**
 * Seção de KPI Cards do Dashboard Suporte.
 * Consome useMetricsOverview e monta cards via KPI_CATALOG.
 * Comparativo vs mês anterior exibido nos campos aplicáveis.
 * Drill-down habilitado via overview?format=rows.
 * AP-SECURITY-001: nenhum label expõe categoria HubSpot — vem do KPI_CATALOG.
 */

import { useMetricsOverview } from '../../shared/hooks/useMetricsOverview'
import { KPI_CATALOG } from '../../shared/utils/kpiCatalog'
import { KpiCard } from '../../shared/components/KpiCard'
import { KpiCardGrid } from '../../shared/components/KpiCardGrid'
import { ErrorState } from '../../../../components/ui/ErrorState'
import { Skeleton } from '../../../../components/ui/Skeleton'
import type { DrillSpec, MetricsScope } from '../../shared/types/metrics'

type SupportKpiSectionProps = {
  scope: MetricsScope
  from: string | null
  to: string | null
  clientId: string | null
  planId: string | null
  /** Drill legado de apontamentos (KPI "Tempo total" — overview?format=rows). */
  onDrillDown?: () => void
  /** Drill paramétrico da família ticket (016): abre a tabela do metric do KPI. */
  onTicketDrill?: (spec: DrillSpec) => void
}

/**
 * Formata o comparativo percentual vs mês anterior.
 * ex: 0.12 → "+12,0%"; -0.05 → "-5,0%"; 0 → "=0,0%"
 */
function formatVariacao(v: number | null | undefined): string | null {
  if (v === null || v === undefined) return null
  const sign = v > 0 ? '+' : v < 0 ? '' : '='
  return `${sign}${new Intl.NumberFormat('pt-BR', {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
    signDisplay: 'auto',
  }).format(v / 100)} vs mês anterior`
}

function variacaoVariant(
  v: number | null | undefined,
): 'positive' | 'negative' | 'neutral' {
  if (v === null || v === undefined) return 'neutral'
  if (v > 0) return 'positive'
  if (v < 0) return 'negative'
  return 'neutral'
}

export function SupportKpiSection({
  scope,
  from,
  to,
  clientId,
  planId,
  onDrillDown,
  onTicketDrill,
}: SupportKpiSectionProps) {
  const { data, isLoading, isError, refetch } = useMetricsOverview({
    scope,
    from,
    to,
    clientId,
    supportPlanId: planId,
  })

  if (isLoading) {
    return (
      <KpiCardGrid>
        {Array.from({ length: KPI_CATALOG.length }).map((_, i) => (
          <Skeleton key={i} lines={1} height="h-20" className="rounded-xl" />
        ))}
      </KpiCardGrid>
    )
  }

  if (isError) {
    return (
      <ErrorState
        message="Não foi possível carregar os KPIs."
        onRetry={refetch}
      />
    )
  }

  return (
    <KpiCardGrid>
      {KPI_CATALOG.map((kpiDef) => {
        const rawValue = data ? data[kpiDef.key] : undefined

        // Comparativo vs mês anterior só para ticketsAbertos e ticketsResolvidos
        let subtext: string | null = null
        let subtextVariant: 'positive' | 'negative' | 'neutral' = 'neutral'

        if (kpiDef.key === 'ticketsAbertos' && data) {
          const variacao = formatVariacao(data.ticketsAbertosVariacaoPercent)
          if (variacao) {
            subtext = variacao
            subtextVariant = variacaoVariant(data.ticketsAbertosVariacaoPercent)
          }
        } else if (kpiDef.key === 'ticketsResolvidos' && data) {
          const variacao = formatVariacao(data.ticketsResolvidosVariacaoPercent)
          if (variacao) {
            subtext = variacao
            subtextVariant = variacaoVariant(data.ticketsResolvidosVariacaoPercent)
          }
        }

        const displayValue =
          rawValue === null || rawValue === undefined
            ? null
            : typeof rawValue === 'number'
              ? rawValue
              : null

        // Drill: família ticket (drill no catálogo) tem precedência; o KPI legado
        // "Tempo total" usa o drill de apontamentos (overview?format=rows).
        let onClick: (() => void) | undefined
        if (kpiDef.drill && onTicketDrill) {
          const spec = kpiDef.drill
          onClick = () => onTicketDrill(spec)
        } else if (onDrillDown && kpiDef.key === 'tempoTotalSegundos') {
          onClick = onDrillDown
        }

        return (
          <KpiCard
            key={kpiDef.key}
            label={kpiDef.label}
            value={displayValue}
            formatter={
              displayValue !== null ? kpiDef.formatter : undefined
            }
            subtext={subtext}
            subtextVariant={subtextVariant}
            tooltipText={kpiDef.tooltipText}
            onClick={onClick}
          />
        )
      })}
    </KpiCardGrid>
  )
}
