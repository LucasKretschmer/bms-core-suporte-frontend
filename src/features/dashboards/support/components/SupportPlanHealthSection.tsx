/**
 * Seção de Saúde dos Planos do Dashboard Suporte.
 * Sempre scope=global — ignora filtro de equipe.
 * Gráfico de barras (verde/amarelo/vermelho).
 * AP-SECURITY-001: labels "< 80% (ok)", "80–95% (atenção)", "≥ 95% (crítico)" — sem categoria HubSpot.
 *
 * Export (017 Fase D): baixa o conjunto FILTRADO de planos já em memória (data.data),
 * sem ida extra ao backend. Nunca expõe categoria HubSpot — só nome do cliente/plano e métricas.
 */

import { useState } from 'react'
import { usePlanHealth } from '../../shared/hooks/usePlanHealth'
import { PlanHealthChart } from '../../shared/components/PlanHealthChart'
import { ChartCard } from '../../shared/components/ChartCard'
import { ExportButtons } from '../../../reports/shared/components/ExportButtons'
import {
  exportToCsv,
  exportToXlsx,
  type ExportColumn,
  type ExportRow,
} from '../../../reports/shared/utils/exportTable'
import { formatHours, formatPercent } from '../../../reports/shared/utils/formatters'
import {
  hasExportablePlanRows,
  hasPlanHealthData,
} from '../../shared/utils/planHealth'
import {
  TEXTO_SAUDE_PLANOS_COMPARACAO,
  TEXTO_SAUDE_PLANOS_ROTULO,
} from '../../../reports/shared/utils/competenciaTexts'
import { useToast } from '../../../../components/ui/Toast'
import type { DrillSpec, PlanHealthItemDto } from '../../shared/types/metrics'

type SupportPlanHealthSectionProps = {
  from: string | null
  to: string | null
  clientId?: string | null
  planId?: string | null
  /** Drill (016 B3): clique numa faixa → tabela dos clientes daquela faixa de saúde. */
  onFaixaDrill?: (spec: DrillSpec) => void
}

const FAIXA_LABEL: Record<PlanHealthItemDto['faixa'], string> = {
  verde: 'Ok (< 80%)',
  amarelo: 'Atenção (80–95%)',
  vermelho: 'Crítico (≥ 95%)',
}

const FAIXA_DRILL_TITLE: Record<'verde' | 'amarelo' | 'vermelho', string> = {
  verde: 'Planos saudáveis (< 80%)',
  amarelo: 'Planos em atenção (80–95%)',
  vermelho: 'Planos críticos (≥ 95%)',
}

/** Colunas de export — espelham os dados visíveis, sem campos internos (AP-SECURITY-001). */
const EXPORT_COLUMNS: ExportColumn[] = [
  { header: 'Cliente', key: 'cliente' },
  { header: 'Plano', key: 'plano' },
  { header: 'Consumo', key: 'consumo' },
  { header: 'Horas do plano', key: 'horasPlano' },
  { header: 'Horas usadas', key: 'horasUsadas' },
  { header: 'Saúde', key: 'saude' },
]

/**
 * Horas → "Xh Ym", com traço quando o número não veio (chave de wire divergente ou
 * `null`): planilha com `NaN` viaja por e-mail e não tem como ser corrigida depois
 * (AP-FRONTEND-028). O `typeof` é proposital — o tipo diz `number`, o wire é que manda.
 */
function formatHorasOuTraco(horas: number | null | undefined): string {
  if (typeof horas !== 'number' || !Number.isFinite(horas)) return '—'
  return formatHours(horas)
}

/** Nomes de campo = os que o backend emite (`MetricsDtos.cs:120-126`) — ver 123/D4. */
function mapPlanToExportRow(item: PlanHealthItemDto): ExportRow {
  return {
    cliente: item.nomeFantasia ?? '—',
    plano: item.planNome ?? '—',
    consumo: formatPercent(item.percentualConsumo),
    horasPlano: formatHorasOuTraco(item.horasContratadas),
    horasUsadas: formatHorasOuTraco(item.horasConsumidas),
    saude: FAIXA_LABEL[item.faixa] ?? '—',
  }
}

export function SupportPlanHealthSection({
  from,
  to,
  clientId,
  planId,
  onFaixaDrill,
}: SupportPlanHealthSectionProps) {
  // Saúde de planos é SEMPRE global — não filtra por equipe (conforme análise §8.2)
  const { data, isLoading, isError, refetch } = usePlanHealth({
    scope: 'global',
    from,
    to,
    clientId,
    supportPlanId: planId,
  })
  const toast = useToast()
  const [isExporting, setIsExporting] = useState(false)

  const summary = data?.summary ?? null
  const planos = data?.data ?? []
  // 123/D4: `!summary` dava falso-negativo — o objeto pode existir e não ter total
  // utilizável, e o card renderizava o gráfico (vazio) em vez da mensagem honesta.
  const isEmpty = !isLoading && !isError && !hasPlanHealthData(summary)
  // O botão de export só é oferecido se existir linha com identificação: com o mismatch de
  // chave o CSV saía inteiro em "—"/NaN com o botão habilitado (achado F7 §1.4).
  const canExport = !isLoading && !isError && hasExportablePlanRows(planos)

  function handleExportCsv() {
    if (isExporting) return
    setIsExporting(true)
    try {
      exportToCsv('saude-planos', EXPORT_COLUMNS, planos.map(mapPlanToExportRow))
      toast.success('Exportação CSV concluída.')
    } catch {
      toast.error('Erro ao exportar. Tente novamente.')
    } finally {
      setIsExporting(false)
    }
  }

  async function handleExportXlsx() {
    if (isExporting) return
    setIsExporting(true)
    try {
      await exportToXlsx('saude-planos', EXPORT_COLUMNS, planos.map(mapPlanToExportRow))
      toast.success('Exportação Excel concluída.')
    } catch {
      toast.error('Erro ao exportar. Tente novamente.')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <ChartCard
      title="Saúde dos Planos"
      /* 123/FE-PER (D-14 / AUTO-1) — o card diz o que mede.
         Este gráfico soma as horas por `TimeEntry.InicioEm`
         (`MetricsQueryRepository.cs:1258-1266`): vai marcando conforme o time lança os
         tempos, que é a decisão do usuário. O relatório Consumo de Planos apura o mesmo
         conceito por `Ticket.FechadoEm` (`ReportQueryRepository.cs:759-763`), que é a regra
         da fatura. **As duas estão certas** — a divergência é legítima e some quando
         explicada; sem o rótulo ela parece erro. Nenhuma consulta mudou aqui: é texto. */
      subtitle={`${TEXTO_SAUDE_PLANOS_ROTULO} ${TEXTO_SAUDE_PLANOS_COMPARACAO}`}
      isLoading={isLoading}
      isError={isError}
      isEmpty={isEmpty}
      emptyMessage="Sem dados de planos para o período."
      onRetry={refetch}
      height={220}
      headerAction={
        canExport ? (
          <ExportButtons
            onExportCsv={handleExportCsv}
            onExportXlsx={() => void handleExportXlsx()}
            isExporting={isExporting}
          />
        ) : undefined
      }
    >
      <PlanHealthChart
        summary={summary}
        height={220}
        onFaixaClick={
          onFaixaDrill
            ? (faixa) =>
                onFaixaDrill({
                  metric: 'plan-health-clientes',
                  title: FAIXA_DRILL_TITLE[faixa],
                  params: { faixa },
                })
            : undefined
        }
      />
    </ChartCard>
  )
}
