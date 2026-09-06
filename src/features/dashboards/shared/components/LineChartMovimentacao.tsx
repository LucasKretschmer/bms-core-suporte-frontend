/**
 * Gráfico de movimentação diária — 5 séries (Recharts LineChart).
 * Cores via chartTokens — nunca hex literal.
 * Labels PT-BR — nunca categoria HubSpot (AP-SECURITY-001).
 *
 * ## 123/D3a — por que a série "só tinha pontos, sem linha"
 *
 * Não era stroke vazio, `dataKey` errado, nulo, ordem nem tipo: é **cardinalidade**.
 * O Recharts **ignora `dot={false}` quando a série tem um único ponto** —
 * `shouldRenderDots(points, dot)` em `node_modules/recharts/es6/component/Dots.js`
 * termina em `return points.length === 1`. E um ponto só não forma path: o `Curve` sai
 * vazio. Medido em render real (recharts 3.8.1): **10 dias -> 5 paths / 0 dots**;
 * **1 dia -> 0 paths / 5 dots** — exatamente o sintoma relatado.
 *
 * Tratamento por cardinalidade (a série tem de ser legível em qualquer uma):
 * - `n >= 2` -> **linha**, sem marcador (o traçado já é o sinal). `dot={false}` vale.
 * - `n === 1` -> não há linha a traçar. Em vez de deixar o Recharts forçar um marcador
 *   default (que é como o defeito se manifestava — parecia gráfico quebrado), o marcador
 *   passa a ser **explícito e maior** (`DOT_PONTO_UNICO`) e vem acompanhado de um aviso
 *   textual dizendo por que não há linha. O ponto vira intenção, não acidente.
 * - `n === 0` -> o card nem chega aqui: `SupportMovimentacaoSection` cai no empty honesto.
 *
 * **Dependência registrada com o backend (fora do escopo desta unidade):** a série cai
 * para um ponto por duas causas do lado do servidor — período com `from == to` (default no
 * dia 1º do mês) e `GetDatasComSnapshotAsync` decidindo "este dia tem snapshot" **sem
 * filtro de escopo** enquanto os dados vêm filtrados por equipe, o que faz dias sumirem do
 * eixo. O tratamento acima **não depende** de nenhuma das duas: ele é função apenas de
 * `data.length`, seja qual for a razão de o array ter chegado com um elemento.
 */

import React, { useMemo, useState } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { format, parseISO } from 'date-fns'
import { getChartTokens } from '../utils/chartTokens'
import { MOVIMENTACAO_SERIES, AVISO_PONTO_UNICO } from '../utils/movimentacao'
import { Skeleton } from '../../../../components/ui/Skeleton'
import { ChartSeriesFilter } from './ChartSeriesFilter'
import type { ChartSeriesFilterItem } from './ChartSeriesFilter'
import type { DailyDataPointDto } from '../types/metrics'

type LineChartMovimentacaoProps = {
  data: DailyDataPointDto[]
  isLoading?: boolean
  height?: number
  className?: string
}

/**
 * Marcador do caso de UM ponto: maior que o dot default e preenchido com o fundo do card,
 * para ler como marcador deliberado. Só é aplicado quando `data.length === 1`.
 */
const DOT_PONTO_UNICO = { r: 4, strokeWidth: 2, fill: 'var(--color-card)' } as const

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

  // 123/D3b — série isolada. Estado LOCAL, de propósito:
  // (a) o servidor ignora: `GET /metrics/daily` devolve sempre as 5 séries, então isolar
  //     não é filtro de consulta e não deve virar parâmetro de requisição;
  // (b) fora da URL: é estado de leitura momentâneo, não endereço. Na URL ele viajaria em
  //     todo link compartilhado e cada alternância viraria navegação (histórico poluído,
  //     re-render da rota) para uma mudança puramente visual.
  const [serieIsolada, setSerieIsolada] = useState<string | null>(null)

  const itensFiltro = useMemo<ChartSeriesFilterItem[]>(
    () =>
      MOVIMENTACAO_SERIES.map(({ key, label, tokenKey }) => ({
        key,
        label,
        color: tokens[tokenKey],
      })),
    [tokens],
  )

  if (isLoading) {
    return <Skeleton lines={1} height={`h-[${height}px]`} className={className} />
  }

  // Cardinalidade 1: não há linha possível — o marcador vira explícito (ver cabeçalho).
  const isPontoUnico = data.length === 1

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
          {MOVIMENTACAO_SERIES.map(({ key, label, tokenKey }) => (
            <Line
              key={key}
              type="monotone"
              dataKey={key}
              name={label}
              stroke={tokens[tokenKey]}
              strokeWidth={2}
              hide={serieIsolada !== null && serieIsolada !== key}
              dot={isPontoUnico ? DOT_PONTO_UNICO : false}
              activeDot={{ r: 4 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>

      {isPontoUnico && <p className="mt-1 text-xs text-muted">{AVISO_PONTO_UNICO}</p>}

      {/* Legenda interativa: substitui o <Legend/> do Recharts, que fica dentro do <svg>
          e é inalcançável por teclado. Mesmo conteúdo (cor + rótulo) + isolamento. */}
      <ChartSeriesFilter
        className="mt-2"
        label="Séries:"
        items={itensFiltro}
        selected={serieIsolada}
        onChange={setSerieIsolada}
      />
    </div>
  )
})
