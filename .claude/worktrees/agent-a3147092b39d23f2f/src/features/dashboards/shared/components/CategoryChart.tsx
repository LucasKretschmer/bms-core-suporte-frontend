/**
 * Gráfico de chamados por categoria (Recharts BarChart vertical).
 *
 * PRIVACIDADE (AP-SECURITY-001): exibe `categoria` diretamente do backend.
 * O backend filtra as categorias proibidas antes de retornar.
 * O teste CategoryChart.test.tsx varre o DOM por valores literais proibidos.
 *
 * Cor única --color-chart-1 para todas as barras (sem semântica por categoria).
 * Tooltip: categoria, count, horas.
 */

import React, { useMemo } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import type { BarRectangleItem } from 'recharts/types/cartesian/Bar'
import { getChartTokens } from '../utils/chartTokens'
import { Skeleton } from '../../../../components/ui/Skeleton'
import { EmptyState } from '../../../../components/ui/EmptyState'
import { formatSeconds } from '../../../reports/shared/utils/formatters'
import type { CategoryMetricDto } from '../types/metrics'

type CategoryChartProps = {
  data: CategoryMetricDto[]
  isLoading?: boolean
  height?: number
  onBarClick?: (categoria: string) => void
  className?: string
}

const MAX_LABEL_LENGTH = 20

function truncate(str: string): string {
  return str.length > MAX_LABEL_LENGTH ? `${str.slice(0, MAX_LABEL_LENGTH)}…` : str
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: Array<{ payload: CategoryMetricDto }>
}) {
  if (!active || !payload?.length) return null
  const item = payload[0].payload
  return (
    <div className="bg-card border border-border rounded-[5px] p-3 shadow text-xs max-w-[220px]">
      <p className="font-medium mb-1 break-words">{item.categoria}</p>
      <p>Chamados: <strong>{item.count}</strong></p>
      <p>Tempo: <strong>{formatSeconds(item.totalSegundos)}</strong></p>
    </div>
  )
}

export const CategoryChart = React.memo(function CategoryChart({
  data,
  isLoading = false,
  height = 240,
  onBarClick,
  className,
}: CategoryChartProps) {
  const tokens = useMemo(() => getChartTokens(), [])

  if (isLoading) {
    return <Skeleton lines={1} height={`h-[${height}px]`} className={className} />
  }

  if (data.length === 0) {
    return (
      <EmptyState
        message="Sem dados de categoria no período. A categoria pode não estar preenchida nos chamados."
        className={className}
      />
    )
  }

  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 24, left: 8, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--color-border)" />
          <XAxis type="number" tick={{ fontSize: 11 }} stroke="var(--color-muted)" allowDecimals={false} />
          <YAxis
            type="category"
            dataKey="categoria"
            width={140}
            tick={{ fontSize: 11 }}
            stroke="var(--color-muted)"
            tickFormatter={truncate}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar
            dataKey="count"
            name="Chamados"
            fill={tokens['chart-1']}
            cursor={onBarClick ? 'pointer' : undefined}
            onClick={
              onBarClick
                ? (data: BarRectangleItem) => {
                    const item = data.payload as CategoryMetricDto | undefined
                    if (item?.categoria) onBarClick(item.categoria)
                  }
                : undefined
            }
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
})
