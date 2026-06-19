/**
 * Gráfico de distribuição por status de pipeline (Recharts BarChart horizontal).
 * Status são dinâmicos do backend — sem lista fixa.
 * Cores por índice estável (ordenação alfabética por pipelineStage).
 * pipelineStage é nome de status operacional — não é categoria HubSpot proibida.
 */

import React, { useMemo } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
  ResponsiveContainer,
} from 'recharts'
import type { BarRectangleItem } from 'recharts/types/cartesian/Bar'
import type { ValueType, NameType } from 'recharts/types/component/DefaultTooltipContent'
import { getChartPalette } from '../utils/chartTokens'
import { Skeleton } from '../../../../components/ui/Skeleton'
import type { StatusDistributionItemDto } from '../types/metrics'

type StatusDistributionChartProps = {
  data: StatusDistributionItemDto[]
  isLoading?: boolean
  height?: number
  onSliceClick?: (pipelineStage: string) => void
  className?: string
}

export const StatusDistributionChart = React.memo(function StatusDistributionChart({
  data,
  isLoading = false,
  height = 240,
  onSliceClick,
  className,
}: StatusDistributionChartProps) {
  const palette = useMemo(() => getChartPalette(), [])

  // Ordenar por pipelineStage para cor estável entre renders
  const sortedData = useMemo(
    () => [...data].sort((a, b) => a.pipelineStage.localeCompare(b.pipelineStage)),
    [data],
  )

  if (isLoading) {
    return <Skeleton lines={1} height={`h-[${height}px]`} className={className} />
  }

  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={sortedData}
          layout="vertical"
          margin={{ top: 4, right: 24, left: 8, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--color-border)" />
          <XAxis type="number" tick={{ fontSize: 11 }} stroke="var(--color-muted)" allowDecimals={false} />
          <YAxis
            type="category"
            dataKey="pipelineStage"
            width={120}
            tick={{ fontSize: 11 }}
            stroke="var(--color-muted)"
          />
          <Tooltip
            formatter={(value: ValueType | undefined, name: NameType | undefined) => [value, name]}
            labelFormatter={(label: React.ReactNode) => label}
          />
          <Legend />
          <Bar
            dataKey="count"
            name="Tickets"
            cursor={onSliceClick ? 'pointer' : undefined}
            onClick={
              onSliceClick
                ? (data: BarRectangleItem) => {
                    const item = data.payload as StatusDistributionItemDto | undefined
                    if (item?.pipelineStage) onSliceClick(item.pipelineStage)
                  }
                : undefined
            }
          >
            {sortedData.map((_, index) => (
              <Cell
                key={`cell-${index}`}
                fill={palette[index % palette.length]}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
})
