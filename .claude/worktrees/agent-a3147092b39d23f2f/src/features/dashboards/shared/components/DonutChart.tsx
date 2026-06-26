import React, { useId, useMemo } from 'react'
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import type { ValueType, NameType } from 'recharts/types/component/DefaultTooltipContent'
import { getChartPalette } from '../utils/chartTokens'

type DonutDataItem = {
  name: string
  value: number
}

type DonutChartProps = {
  /** ID manual — se omitido, gerado via useId() (AP-FRONTEND-003) */
  id?: string
  data: DonutDataItem[]
  /** Paleta customizada — se omitida usa getChartPalette() */
  colorTokens?: string[]
  innerRadius?: number
  outerRadius?: number
  height?: number
  className?: string
}

/**
 * Donut chart genérico (Onboarding).
 * Cores via chartTokens — nunca hex literal.
 * Tooltip formata número com Intl.NumberFormat pt-BR.
 * React.memo para evitar re-renders.
 */
export const DonutChart = React.memo(function DonutChart({
  id: idProp,
  data,
  colorTokens,
  innerRadius = 60,
  outerRadius = 90,
  height = 240,
  className,
}: DonutChartProps) {
  const generatedId = useId()
  const rootId = idProp ?? generatedId

  const palette = useMemo(
    () => colorTokens ?? getChartPalette(),
    [colorTokens],
  )

  const formatter = new Intl.NumberFormat('pt-BR')

  return (
    <div id={rootId} className={className}>
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={innerRadius}
            outerRadius={outerRadius}
            dataKey="value"
          >
            {data.map((_, index) => (
              <Cell
                key={`cell-${index}`}
                fill={palette[index % palette.length]}
              />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: ValueType | undefined, _name: NameType | undefined) =>
              [typeof value === 'number' ? formatter.format(value) : String(value ?? ''), '']
            }
          />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
})
