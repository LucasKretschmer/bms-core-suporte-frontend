/**
 * Gráfico de saúde dos planos (Recharts BarChart).
 * Cores verde/amarelo/vermelho via chartTokens.
 * Sempre scope=global (ignora filtro de equipe).
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
import { clsx } from 'clsx'
import { getChartTokens } from '../utils/chartTokens'
import { Skeleton } from '../../../../components/ui/Skeleton'
import { EmptyState } from '../../../../components/ui/EmptyState'
import type { PlanHealthSummaryDto } from '../types/metrics'

type PlanHealthChartProps = {
  summary: PlanHealthSummaryDto | null
  isLoading?: boolean
  height?: number
  className?: string
}

type FaixaSaude = 'verde' | 'amarelo' | 'vermelho'

const FAIXA_LABEL: Record<FaixaSaude, string> = {
  verde: '< 80% (ok)',
  amarelo: '80–95% (atenção)',
  vermelho: '≥ 95% (crítico)',
}

export const PlanHealthChart = React.memo(function PlanHealthChart({
  summary,
  isLoading = false,
  height = 200,
  className,
}: PlanHealthChartProps) {
  const tokens = useMemo(() => getChartTokens(), [])

  if (isLoading) {
    return <Skeleton lines={3} height="h-[60px]" className={className} />
  }

  if (!summary) {
    return <EmptyState message="Sem dados de planos para o período." className={className} />
  }

  const chartData = [
    {
      name: 'Planos',
      verde: summary.totalVerde,
      amarelo: summary.totalAmarelo,
      vermelho: summary.totalVermelho,
    },
  ]

  return (
    <div className={clsx('flex flex-col gap-4', className)}>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={chartData} margin={{ top: 4, right: 24, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="var(--color-muted)" />
          <YAxis tick={{ fontSize: 11 }} stroke="var(--color-muted)" allowDecimals={false} />
          <Tooltip />
          <Legend
            formatter={(value: string) => FAIXA_LABEL[value as FaixaSaude] ?? value}
          />
          <Bar dataKey="verde" name="verde" fill={tokens['chart-verde']} />
          <Bar dataKey="amarelo" name="amarelo" fill={tokens['chart-amarelo']} />
          <Bar dataKey="vermelho" name="vermelho" fill={tokens['chart-vermelho']} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
})
