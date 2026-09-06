/**
 * Gráfico 1ª resposta vs SLA (Recharts BarChart).
 * Derivado dos campos respondidosNoPrazo / respondidosForaDoPrazo do MetricsOverviewDto.
 * Cores via chartTokens (verde / vermelho) — nunca hex literal.
 * Labels sem categoria HubSpot (AP-SECURITY-001).
 *
 * ## 124/FE-TXT — o empty defensivo deixou de mandar o usuário ao Service Hub
 *
 * Até `BE-F4F5` o SLA era lido de `tickets.frsla` — coluna que a ingestão grava SEMPRE
 * `null` de propósito (`HubSpotClient.cs:1096`, com o motivo escrito lá). Desde então os
 * dois campos são CALCULADOS na leitura, a partir da configuração LOCAL: meta de 1ª
 * resposta no plano do cliente + calendário com expediente cadastrado
 * (`MetricsService.cs:860-874`; os 7 caminhos que produzem `null` estão no §3 do
 * `be-f4f5-report.md`). A dependência do Service Hub foi abandonada por decisão
 * (`AUTO-124-12`), e o texto antigo passou a apontar o gestor para o lugar errado —
 * `AP-FRONTEND-022`: texto de UI que afirma comportamento do sistema é código, não copy.
 *
 * Este empty continua **defensivo**: a `SupportSlaSection` (124/FE-F4) discrimina os dois
 * significados do `null` ("não configurado" × "sem chamado no período") com o
 * `ticketsAbertos` do mesmo overview e nunca chega aqui. Um consumidor que monte o
 * gráfico sozinho NÃO tem esse discriminador — por isso a frase abaixo não elege causa
 * (não afirma "não configurado" nem "sem chamado"), apenas nomeia a condição do cálculo,
 * com o mesmo vocabulário de `supportSlaStates.ts`.
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
import { ChartDrillLegend, type ChartDrillLegendItem } from './ChartDrillLegend'
import { Skeleton } from '../../../../components/ui/Skeleton'
import { EmptyState } from '../../../../components/ui/EmptyState'

type FirstResponseVsSlaChartProps = {
  respondidosNoPrazo: number | null
  respondidosForaDoPrazo: number | null
  isLoading?: boolean
  height?: number
  className?: string
  /** Drill (016): clique na barra → 'on' (no prazo) | 'late' (fora). */
  onSegmentClick?: (sla: 'on' | 'late') => void
}

/**
 * A frase do empty defensivo. Módulo-local de propósito: quem tem o discriminador
 * (`SupportSlaSection`) usa os textos de `support/components/supportSlaStates.ts`, e
 * `dashboards/shared/**` não pode importar de `dashboards/support/**` — seria inverter a
 * direção da dependência (compartilhado passando a depender de uma feature).
 *
 * ⚠️ A segunda metade é a MESMA FRASE, palavra por palavra, de
 * `supportSlaStates.PRE_CONDICAO_DO_CALCULO_DO_SLA` — um fato, um texto. A cópia existe só
 * por causa da direção da dependência, e **não é mantida no olho**: há teste de componente
 * que compara as duas fontes reais e reprova se elas divergirem.
 *
 * A precedência da meta está conferida no backend: `MetricsService.cs:691` faz
 * `fonte.PlanoSlaMinutos ?? metaDoCalendario`, e `ICalendarioProvider.cs:36-43` descreve
 * `calendarios.slapadraominutos` como a herança de `plano ?? calendário`. Quem preencheu
 * só a meta padrão do calendário está corretamente configurado.
 *
 * O que NÃO se repete de lá é a atribuição de causa: sem `chamadosNoPeriodo`, este
 * componente não sabe se falta configuração ou se falta chamado, e por isso não afirma
 * nenhum dos dois.
 */
const MENSAGEM_SLA_SEM_APURACAO =
  'SLA de 1ª resposta sem apuração para o período. ' +
  'O cálculo exige um calendário com expediente cadastrado e uma meta de 1ª resposta — ' +
  'do plano do cliente ou, na falta dela, a meta padrão do calendário.'

export const FirstResponseVsSlaChart = React.memo(function FirstResponseVsSlaChart({
  respondidosNoPrazo,
  respondidosForaDoPrazo,
  isLoading = false,
  height = 240,
  className,
  onSegmentClick,
}: FirstResponseVsSlaChartProps) {
  const tokens = useMemo(() => getChartTokens(), [])

  if (isLoading) {
    return <Skeleton lines={1} height={`h-[${height}px]`} className={className} />
  }

  // Empty conservador (#5): se QUALQUER lado for null, o SLA do período não foi apurado.
  // Não usar `?? 0` num lado null — mostraria "zero respostas" enganosamente. Defensivo
  // caso o gráfico seja reusado sem o ChartCard da section.
  if (respondidosNoPrazo === null || respondidosForaDoPrazo === null) {
    return <EmptyState message={MENSAGEM_SLA_SEM_APURACAO} className={className} />
  }

  const chartData = [
    {
      name: 'SLA',
      noPrazo: respondidosNoPrazo,
      foraDoPrazo: respondidosForaDoPrazo,
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
            cursor={onSegmentClick ? 'pointer' : undefined}
            onClick={onSegmentClick ? () => onSegmentClick('on') : undefined}
          />
          <Bar
            dataKey="foraDoPrazo"
            name="Respondidos fora do prazo"
            fill={tokens['chart-vermelho']}
            cursor={onSegmentClick ? 'pointer' : undefined}
            onClick={onSegmentClick ? () => onSegmentClick('late') : undefined}
          />
        </BarChart>
      </ResponsiveContainer>

      {/* WCAG 2.1.1 (WCAG-1): mesmo drill das barras ('on' | 'late'), alcançável por Tab. */}
      {onSegmentClick && (
        <ChartDrillLegend
          label="Abrir tickets por SLA de primeira resposta"
          items={[
            {
              key: 'on',
              label: 'No prazo',
              value: respondidosNoPrazo,
              color: tokens['chart-verde'],
              actionLabel: `Ver tickets respondidos no prazo (${respondidosNoPrazo})`,
              onSelect: () => onSegmentClick('on'),
            },
            {
              key: 'late',
              label: 'Fora do prazo',
              value: respondidosForaDoPrazo,
              color: tokens['chart-vermelho'],
              actionLabel: `Ver tickets respondidos fora do prazo (${respondidosForaDoPrazo})`,
              onSelect: () => onSegmentClick('late'),
            },
          ] satisfies ChartDrillLegendItem[]}
        />
      )}
    </div>
  )
})
