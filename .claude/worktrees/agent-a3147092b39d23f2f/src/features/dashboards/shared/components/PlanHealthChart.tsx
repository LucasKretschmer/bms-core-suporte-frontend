/**
 * Gráfico de saúde dos planos (Recharts BarChart + tabela).
 * Cores verde/amarelo/vermelho via chartTokens.
 * Badge colorido na tabela para faixaSaude.
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
import { formatPercent } from '../../../reports/shared/utils/formatters'
import type { PlanHealthSummaryDto, PlanHealthItemDto } from '../types/metrics'

type PlanHealthChartProps = {
  summary: PlanHealthSummaryDto | null
  items: PlanHealthItemDto[]
  isLoading?: boolean
  height?: number
  onClientClick?: (clientId: number) => void
  className?: string
}

type FaixaSaude = 'verde' | 'amarelo' | 'vermelho'

const FAIXA_BADGE: Record<FaixaSaude, string> = {
  verde: 'bg-success-bg text-success-fg',
  amarelo: 'bg-warning-bg text-warning-fg',
  vermelho: 'bg-error-bg text-error-fg',
}

const FAIXA_LABEL: Record<FaixaSaude, string> = {
  verde: '< 80% (ok)',
  amarelo: '80–95% (atenção)',
  vermelho: '≥ 95% (crítico)',
}

export const PlanHealthChart = React.memo(function PlanHealthChart({
  summary,
  items,
  isLoading = false,
  height = 200,
  onClientClick,
  className,
}: PlanHealthChartProps) {
  const tokens = useMemo(() => getChartTokens(), [])

  if (isLoading) {
    return <Skeleton lines={3} height="h-[60px]" className={className} />
  }

  if (!summary && items.length === 0) {
    return <EmptyState message="Sem dados de planos para o período." className={className} />
  }

  const chartData = summary
    ? [
        {
          name: 'Planos',
          verde: summary.totalVerde,
          amarelo: summary.totalAmarelo,
          vermelho: summary.totalVermelho,
        },
      ]
    : []

  return (
    <div className={clsx('flex flex-col gap-4', className)}>
      {/* Gráfico de barras do resumo */}
      {summary && (
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={chartData} margin={{ top: 4, right: 24, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="var(--color-muted)" />
            <YAxis tick={{ fontSize: 11 }} stroke="var(--color-muted)" allowDecimals={false} />
            <Tooltip />
            <Legend
              formatter={(value: string) =>
                FAIXA_LABEL[value as FaixaSaude] ?? value
              }
            />
            <Bar dataKey="verde" name="verde" fill={tokens['chart-verde']} />
            <Bar dataKey="amarelo" name="amarelo" fill={tokens['chart-amarelo']} />
            <Bar dataKey="vermelho" name="vermelho" fill={tokens['chart-vermelho']} />
          </BarChart>
        </ResponsiveContainer>
      )}

      {/* Tabela de itens */}
      {items.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr>
                <th className="h-9 px-3 text-left font-medium text-foreground/80 bg-background border-[0.7px] border-border rounded-tl-[5px]">
                  Cliente
                </th>
                <th className="h-9 px-3 text-left font-medium text-foreground/80 bg-background border-[0.7px] border-border">
                  Plano
                </th>
                <th className="h-9 px-3 text-right font-medium text-foreground/80 bg-background border-[0.7px] border-border">
                  Consumo
                </th>
                <th className="h-9 px-3 text-center font-medium text-foreground/80 bg-background border-[0.7px] border-border rounded-tr-[5px]">
                  Faixa
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr
                  key={item.clientId}
                  onClick={onClientClick ? () => onClientClick(item.clientId) : undefined}
                  role={onClientClick ? 'button' : undefined}
                  tabIndex={onClientClick ? 0 : undefined}
                  onKeyDown={
                    onClientClick
                      ? (e) => {
                          if (e.key === 'Enter') onClientClick(item.clientId)
                        }
                      : undefined
                  }
                  className={clsx(
                    'border-[0.7px] border-border border-t-0',
                    onClientClick &&
                      'cursor-pointer hover:shadow-[0_1px_3px_1px_rgba(0,0,0,0.15)] transition-shadow duration-150',
                  )}
                >
                  <td className="h-[38px] px-3 py-[9px] text-foreground">
                    {item.nomeCliente ?? '—'}
                  </td>
                  <td className="h-[38px] px-3 py-[9px] text-foreground">
                    {item.nomePlano ?? '—'}
                  </td>
                  <td className="h-[38px] px-3 py-[9px] text-right text-foreground">
                    {formatPercent(item.percentualConsumo)}
                  </td>
                  <td className="h-[38px] px-3 py-[9px] text-center">
                    <span
                      className={clsx(
                        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                        FAIXA_BADGE[item.faixaSaude],
                      )}
                    >
                      {FAIXA_LABEL[item.faixaSaude]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
})
