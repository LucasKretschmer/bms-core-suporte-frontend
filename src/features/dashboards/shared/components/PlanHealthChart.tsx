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
import { ChartDrillLegend, type ChartDrillLegendItem } from './ChartDrillLegend'
import { Skeleton } from '../../../../components/ui/Skeleton'
import { EmptyState } from '../../../../components/ui/EmptyState'
import type { PlanHealthSummaryDto } from '../types/metrics'

type FaixaSaude = 'verde' | 'amarelo' | 'vermelho'

type PlanHealthChartProps = {
  summary: PlanHealthSummaryDto | null
  isLoading?: boolean
  height?: number
  className?: string
  /** Drill (016 B3): clique numa faixa → tabela dos clientes daquela faixa. */
  onFaixaClick?: (faixa: FaixaSaude) => void
}

const FAIXA_LABEL: Record<FaixaSaude, string> = {
  verde: '< 80% (ok)',
  amarelo: '80–95% (atenção)',
  vermelho: '≥ 95% (crítico)',
}

/**
 * Nome acessível da faixa: `<` e `≥` são lidos de forma inconsistente por leitor de tela
 * (e às vezes ignorados), por isso o texto do `aria-label` é por extenso — o rótulo
 * visível continua sendo o `FAIXA_LABEL`, igual ao da legenda do gráfico.
 */
const FAIXA_LABEL_ACESSIVEL: Record<FaixaSaude, string> = {
  verde: 'consumo abaixo de 80%',
  amarelo: 'consumo entre 80% e 95%',
  vermelho: 'consumo de 95% ou mais',
}

export const PlanHealthChart = React.memo(function PlanHealthChart({
  summary,
  isLoading = false,
  height = 200,
  className,
  onFaixaClick,
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
          <Bar
            dataKey="verde"
            name="verde"
            fill={tokens['chart-verde']}
            cursor={onFaixaClick ? 'pointer' : undefined}
            onClick={onFaixaClick ? () => onFaixaClick('verde') : undefined}
          />
          <Bar
            dataKey="amarelo"
            name="amarelo"
            fill={tokens['chart-amarelo']}
            cursor={onFaixaClick ? 'pointer' : undefined}
            onClick={onFaixaClick ? () => onFaixaClick('amarelo') : undefined}
          />
          <Bar
            dataKey="vermelho"
            name="vermelho"
            fill={tokens['chart-vermelho']}
            cursor={onFaixaClick ? 'pointer' : undefined}
            onClick={onFaixaClick ? () => onFaixaClick('vermelho') : undefined}
          />
        </BarChart>
      </ResponsiveContainer>

      {/* WCAG 2.1.1 (WCAG-1): mesmo drill das barras (a faixa), alcançável por Tab. */}
      {onFaixaClick && (
        <ChartDrillLegend
          label="Abrir clientes por faixa de saúde do plano"
          items={(['verde', 'amarelo', 'vermelho'] as const).map<ChartDrillLegendItem>((faixa) => {
            const total =
              faixa === 'verde'
                ? summary.totalVerde
                : faixa === 'amarelo'
                  ? summary.totalAmarelo
                  : summary.totalVermelho
            return {
              key: faixa,
              label: FAIXA_LABEL[faixa],
              value: total,
              color: tokens[`chart-${faixa}`],
              actionLabel: `Ver clientes com ${FAIXA_LABEL_ACESSIVEL[faixa]} do plano (${total})`,
              onSelect: () => onFaixaClick(faixa),
            }
          })}
        />
      )}
    </div>
  )
})
