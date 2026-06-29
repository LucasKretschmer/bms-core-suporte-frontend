/**
 * Seção de Chamados por Categoria do Dashboard Suporte.
 *
 * AP-SECURITY-001: exibe 'categoria' do DTO — o backend filtra as proibidas.
 * O teste CategoryChart.test.tsx varre o DOM por valores literais proibidos.
 * Drill-down (016 B1): clique numa barra → tabela dos apontamentos daquela categoria
 * (família apontamento, metric=apontamentos&categoria=...). O backend rejeita categorias
 * proibidas (422); o título do modal usa o nome da categoria já exibido no gráfico.
 */

import { useByCategory } from '../../shared/hooks/useByCategory'
import { CategoryChart } from '../../shared/components/CategoryChart'
import { ChartCard } from '../../shared/components/ChartCard'
import type { DrillSpec, MetricsScope } from '../../shared/types/metrics'

type SupportCategorySectionProps = {
  scope: MetricsScope
  from: string | null
  to: string | null
  clientId?: string | null
  planId?: string | null
  /** Drill (016): clique na barra → tabela dos apontamentos da categoria. */
  onCategoryDrill?: (spec: DrillSpec) => void
}

export function SupportCategorySection({
  scope,
  from,
  to,
  clientId,
  planId,
  onCategoryDrill,
}: SupportCategorySectionProps) {
  const { data, isLoading, isError, refetch } = useByCategory({
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
      title="Chamados por Categoria"
      isLoading={isLoading}
      isError={isError}
      isEmpty={isEmpty}
      emptyMessage="Sem dados de categoria para o período."
      onRetry={refetch}
      height={300}
    >
      <CategoryChart
        data={items}
        height={300}
        onBarClick={
          onCategoryDrill
            ? (categoria) =>
                onCategoryDrill({
                  metric: 'apontamentos',
                  title: `Apontamentos — ${categoria}`,
                  params: { categoria },
                })
            : undefined
        }
      />
    </ChartCard>
  )
}
