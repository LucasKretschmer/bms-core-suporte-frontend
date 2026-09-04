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
import { ChartDrillLegend, type ChartDrillLegendItem } from './ChartDrillLegend'

export type DonutDataItem = {
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
  /**
   * Drill (016): clique numa fatia → callback com o índice da fatia (na ordem de `data`).
   * Quando definido, as fatias ganham cursor pointer.
   */
  onSliceClick?: (index: number) => void
  /**
   * WCAG-1: nome acessível da lista de botões que dá acesso ao drill pelo TECLADO
   * (`aria-label` do `<ul>`). Este componente é genérico e não sabe o que a fatia
   * representa — quem o usa precisa dizer, senão o leitor de tela anuncia uma lista
   * anônima. Ex.: "Abrir projetos por estágio".
   */
  drillListLabel?: string
  /**
   * WCAG-1: nome acessível de cada botão de drill. Mesma razão do `drillListLabel` —
   * o padrão ("Ver <nome> (<valor>)") é genérico de propósito.
   */
  drillItemLabel?: (item: DonutDataItem) => string
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
  onSliceClick,
  drillListLabel = 'Abrir detalhes por fatia',
  drillItemLabel,
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
            cursor={onSliceClick ? 'pointer' : undefined}
            onClick={
              onSliceClick
                ? (_data: unknown, index: number) => onSliceClick(index)
                : undefined
            }
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

      {/* WCAG 2.1.1 (WCAG-1): as fatias do Recharts não estão na ordem de tabulação.
          Mesmo alvo do clique: o ÍNDICE da fatia na ordem de `data`. */}
      {onSliceClick && (
        <ChartDrillLegend
          label={drillListLabel}
          items={data.map<ChartDrillLegendItem>((item, index) => ({
            key: `${item.name}-${index}`,
            label: item.name,
            value: formatter.format(item.value),
            color: palette[index % palette.length],
            actionLabel:
              drillItemLabel?.(item) ?? `Ver ${item.name} (${formatter.format(item.value)})`,
            onSelect: () => onSliceClick(index),
          }))}
        />
      )}
    </div>
  )
})
