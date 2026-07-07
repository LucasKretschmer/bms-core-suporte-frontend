/**
 * Gráfico de movimentação diária — 5 séries (Recharts LineChart).
 * Cores via chartTokens — nunca hex literal.
 * Labels PT-BR — nunca categoria HubSpot (AP-SECURITY-001).
 */

import React, { useMemo } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { format, parseISO } from 'date-fns'
import { getChartTokens } from '../utils/chartTokens'
import { Skeleton } from '../../../../components/ui/Skeleton'
import type { DailyDataPointDto } from '../types/metrics'

type LineChartMovimentacaoProps = {
  data: DailyDataPointDto[]
  isLoading?: boolean
  height?: number
  className?: string
}

const SERIES = [
  { key: 'novos' as const, label: 'Novos', tokenKey: 'chart-novos' as const },
  { key: 'emAndamento' as const, label: 'Em atendimento', tokenKey: 'chart-andamento' as const },
  { key: 'resolvidos' as const, label: 'Resolvidos', tokenKey: 'chart-resolvidos' as const },
  { key: 'cancelados' as const, label: 'Cancelados', tokenKey: 'chart-cancelados' as const },
  { key: 'emAberto' as const, label: 'Em aberto', tokenKey: 'chart-aberto' as const },
]

function formatXAxis(dateStr: string): string {
  try {
    return format(parseISO(dateStr), 'dd/MM')
  } catch {
    return dateStr
  }
}

function formatTooltipDate(dateStr: string): string {
  try {
    return format(parseISO(dateStr), 'dd/MM/yyyy')
  } catch {
    return dateStr
  }
}

/**
 * Tooltip customizado que formata a data completa.
 */
function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ name: string; value: number; color: string }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-card border border-border rounded-control p-3 shadow text-xs">
      <p className="font-medium mb-1">{label ? formatTooltipDate(label) : ''}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: <strong>{p.value}</strong>
        </p>
      ))}
    </div>
  )
}

export const LineChartMovimentacao = React.memo(function LineChartMovimentacao({
  data,
  isLoading = false,
  height = 240,
  className,
}: LineChartMovimentacaoProps) {
  const tokens = useMemo(() => getChartTokens(), [])

  if (isLoading) {
    return <Skeleton lines={1} height={`h-[${height}px]`} className={className} />
  }

  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis
            dataKey="data"
            tickFormatter={formatXAxis}
            tick={{ fontSize: 11 }}
            stroke="var(--color-muted)"
          />
          <YAxis tick={{ fontSize: 11 }} stroke="var(--color-muted)" allowDecimals={false} />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          {SERIES.map(({ key, label, tokenKey }) => (
            <Line
              key={key}
              type="monotone"
              dataKey={key}
              name={label}
              stroke={tokens[tokenKey]}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
})
