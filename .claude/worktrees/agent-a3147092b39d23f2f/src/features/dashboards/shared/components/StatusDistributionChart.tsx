/**
 * Gráfico de distribuição por status de pipeline (Recharts BarChart — barras VERTICAIS).
 *
 * União discriminada por `byTeam`:
 *  - byTeam === false (equipe): X = status, uma barra por status (cor por status).
 *  - byTeam === true (global):  X = equipe, barras empilhadas por status (stackId).
 *
 * Cores estáveis por status: o mesmo status tem a mesma cor em todas as barras
 * empilhadas (mapa status→cor por ordem alfabética de status, memoizado).
 *
 * #2: exibe `status` (label legível do backend via pipelinestages) — SEM mapeamento
 *     de código no FE. Se o BE não casar, vem o stageId cru e renderizamos assim mesmo.
 *
 * AP-FRONTEND-007: handlers do Recharts tipados contra os tipos da lib
 * (`BarRectangleItem`, `ValueType`, `NameType`) — narrowing via `payload`.
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
import type {
  StatusDistributionDto,
  StatusDistributionItemDto,
  TeamStatusDistributionDto,
} from '../types/metrics'

type StatusDistributionChartProps = {
  data: StatusDistributionDto
  isLoading?: boolean
  height?: number
  onSliceClick?: (stageId: string) => void
  className?: string
}

// ── Funções puras (testáveis isoladamente) ───────────────────────────────────

/**
 * Constrói o mapa status → cor de forma ESTÁVEL: ordena os status alfabeticamente
 * e atribui cores da paleta por índice. Mesmo conjunto de status (em qualquer ordem)
 * → mesmo mapa, garantindo cor coerente entre barras empilhadas e entre renders.
 */
export function buildColorByStatus(
  statuses: string[],
  palette: string[],
): Record<string, string> {
  const unique = Array.from(new Set(statuses)).sort((a, b) => a.localeCompare(b))
  const map: Record<string, string> = {}
  unique.forEach((status, index) => {
    map[status] = palette[index % palette.length]
  })
  return map
}

/** Linha do BarChart no modo global: equipe + uma chave por status com sua contagem. */
export type StackedRow = {
  equipe: string
  [status: string]: string | number
}

/**
 * Pivot do modo global: cada equipe vira uma linha; cada status vira uma chave
 * (`{ equipe, [status]: count }`). Status duplicados na mesma equipe são somados.
 */
export function toStackedRows(teams: TeamStatusDistributionDto[]): StackedRow[] {
  return teams.map((team) => {
    const row: StackedRow = { equipe: team.equipe }
    for (const item of team.porStatus) {
      const current = row[item.status]
      row[item.status] = (typeof current === 'number' ? current : 0) + item.count
    }
    return row
  })
}

/** Conjunto único de status presente no dado (qualquer escopo), ordenado alfabeticamente. */
export function collectStatuses(data: StatusDistributionDto): string[] {
  const statuses = data.byTeam
    ? data.data.flatMap((team) => team.porStatus.map((s) => s.status))
    : data.data.map((s) => s.status)
  return Array.from(new Set(statuses)).sort((a, b) => a.localeCompare(b))
}

/** Mapa status → stageId (para drill-down a partir do nome da série). */
function buildStageIdByStatus(data: StatusDistributionDto): Record<string, string> {
  const items: StatusDistributionItemDto[] = data.byTeam
    ? data.data.flatMap((team) => team.porStatus)
    : data.data
  const map: Record<string, string> = {}
  for (const item of items) {
    if (!(item.status in map)) map[item.status] = item.stageId
  }
  return map
}

// ── Tooltip do modo empilhado (global) ───────────────────────────────────────

function StackedTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ name?: NameType; value?: ValueType; color?: string }>
  label?: React.ReactNode
}) {
  if (!active || !payload?.length) return null
  const visible = payload.filter((p) => typeof p.value === 'number' && (p.value as number) > 0)
  if (visible.length === 0) return null
  return (
    <div className="bg-card border border-border rounded-[5px] p-3 shadow text-xs max-w-[240px]">
      <p className="font-medium mb-1 break-words">{label}</p>
      {visible.map((p, i) => (
        <p key={i} className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="inline-block w-2 h-2 rounded-[2px]"
            style={{ backgroundColor: p.color }}
          />
          <span className="break-words">{String(p.name)}:</span>
          <strong>{String(p.value)}</strong>
        </p>
      ))}
    </div>
  )
}

// ── Componente ────────────────────────────────────────────────────────────────

export const StatusDistributionChart = React.memo(function StatusDistributionChart({
  data,
  isLoading = false,
  height = 240,
  onSliceClick,
  className,
}: StatusDistributionChartProps) {
  const palette = useMemo(() => getChartPalette(), [])

  const statuses = useMemo(() => collectStatuses(data), [data])
  const colorByStatus = useMemo(
    () => buildColorByStatus(statuses, palette),
    [statuses, palette],
  )
  const stageIdByStatus = useMemo(() => buildStageIdByStatus(data), [data])

  const stackedRows = useMemo(
    () => (data.byTeam ? toStackedRows(data.data) : []),
    [data],
  )

  // Modo equipe: ordenar por status para cor/posição estáveis
  const teamRows = useMemo(
    () =>
      data.byTeam
        ? []
        : [...data.data].sort((a, b) => a.status.localeCompare(b.status)),
    [data],
  )

  if (isLoading) {
    return <Skeleton lines={1} height={`h-[${height}px]`} className={className} />
  }

  // Defesa contra dado vazio (o ChartCard trata o empty antes, mas robustez extra)
  if (statuses.length === 0 || (data.byTeam ? data.data.length === 0 : data.data.length === 0)) {
    return null
  }

  // ── Modo global: barras verticais empilhadas por status ─────────────────────
  if (data.byTeam) {
    return (
      <div className={className}>
        <ResponsiveContainer width="100%" height={height}>
          <BarChart
            data={stackedRows}
            margin={{ top: 4, right: 24, left: 8, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
            <XAxis
              type="category"
              dataKey="equipe"
              tick={{ fontSize: 11 }}
              stroke="var(--color-muted)"
              interval={0}
            />
            <YAxis
              type="number"
              tick={{ fontSize: 11 }}
              stroke="var(--color-muted)"
              allowDecimals={false}
            />
            <Tooltip content={<StackedTooltip />} cursor={{ fill: 'var(--color-border)', opacity: 0.3 }} />
            <Legend />
            {statuses.map((status) => (
              <Bar
                key={status}
                dataKey={status}
                stackId="status"
                name={status}
                fill={colorByStatus[status]}
                cursor={onSliceClick ? 'pointer' : undefined}
                onClick={
                  onSliceClick
                    ? () => {
                        const stageId = stageIdByStatus[status]
                        if (stageId) onSliceClick(stageId)
                      }
                    : undefined
                }
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    )
  }

  // ── Modo equipe: barras verticais, uma por status (cor por status) ──────────
  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={teamRows}
          margin={{ top: 4, right: 24, left: 8, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
          <XAxis
            type="category"
            dataKey="status"
            tick={{ fontSize: 11 }}
            stroke="var(--color-muted)"
            interval={0}
          />
          <YAxis
            type="number"
            tick={{ fontSize: 11 }}
            stroke="var(--color-muted)"
            allowDecimals={false}
          />
          <Tooltip
            formatter={(value: ValueType | undefined, name: NameType | undefined) => [value, name]}
            labelFormatter={(label: React.ReactNode) => label}
            cursor={{ fill: 'var(--color-border)', opacity: 0.3 }}
          />
          <Legend />
          <Bar
            dataKey="count"
            name="Tickets"
            cursor={onSliceClick ? 'pointer' : undefined}
            onClick={
              onSliceClick
                ? (bar: BarRectangleItem) => {
                    const item = bar.payload as StatusDistributionItemDto | undefined
                    if (item?.stageId) onSliceClick(item.stageId)
                  }
                : undefined
            }
          >
            {teamRows.map((item) => (
              <Cell key={item.stageId} fill={colorByStatus[item.status]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
})
