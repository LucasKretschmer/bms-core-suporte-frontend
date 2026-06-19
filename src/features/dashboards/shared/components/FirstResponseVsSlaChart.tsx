/**
 * Gráfico 1ª resposta vs SLA (Recharts BarChart).
 * Derivado dos campos respondidosNoPrazo / respondidosForaDoPrazo do MetricsOverviewDto.
 * Cores via chartTokens (verde / vermelho) — nunca hex literal.
 * Labels sem categoria HubSpot (AP-SECURITY-001).
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
  ResponsiveContainer,
} from 'recharts'
import { getChartTokens } from '../utils/chartTokens'
import { Skeleton } from '../../../../components/ui/Skeleton'
import { EmptyState } from '../../../../components/ui/EmptyState'

type FirstResponseVsSlaChartProps = {
  respondidosNoPrazo: number | null
  respondidosForaDoPrazo: number | null
  isLoading?: boolean
  height?: number
  className?: string
}

export const FirstResponseVsSlaChart = React.memo(function FirstResponseVsSlaChart({
  respondidosNoPrazo,
  respondidosForaDoPrazo,
  isLoading = false,
  height = 240,
  className,
}: FirstResponseVsSlaChartProps) {
  const tokens = useMemo(() => getChartTokens(), [])

  if (isLoading) {
    return <Skeleton lines={1} height={`h-[${height}px]`} className={className} />
  }

  if (respondidosNoPrazo === null && respondidosForaDoPrazo === null) {
    return (
      <EmptyState
        message="Dados de SLA não disponíveis. Requer configuração no Service Hub."
        className={className}
      />
    )
  }

  const chartData = [
    {
      name: 'SLA',
      noPrazo: respondidosNoPrazo ?? 0,
      foraDoPrazo: respondidosForaDoPrazo ?? 0,
    },
  ]

  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={chartData} margin={{ top: 4, right: 24, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="var(--color-muted)" />
          <YAxis tick={{ fontSize: 11 }} stroke="var(--color-muted)" allowDecimals={false} />
          <Tooltip />
          <Legend />
          <Bar
            dataKey="noPrazo"
            name="Respondidos no prazo"
            fill={tokens['chart-verde']}
          />
          <Bar
            dataKey="foraDoPrazo"
            name="Respondidos fora do prazo"
            fill={tokens['chart-vermelho']}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
})
