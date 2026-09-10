/**
 * Seção de Saúde dos Planos do Dashboard Suporte.
 * Sempre scope=global — ignora filtro de equipe.
 * Gráfico de barras (verde/amarelo/vermelho).
 * AP-SECURITY-001: labels "< 80% (ok)", "80–95% (atenção)", "≥ 95% (crítico)" — sem categoria HubSpot.
 *
 * Export (017 Fase D): baixa o conjunto FILTRADO de planos já em memória (data.data),
 * sem ida extra ao backend. Nunca expõe categoria HubSpot — só nome do cliente/plano e métricas.
 *
 * 134: as duas colunas de HORAS do arquivo saem calculáveis (número + `[h]:mm:ss` no XLSX,
 * `H:mm:ss` no CSV). A TELA não muda — este card desenha faixas/contagens, não horas.
 */

import { useState } from 'react'
import { usePlanHealth } from '../../shared/hooks/usePlanHealth'
import { PlanHealthChart } from '../../shared/components/PlanHealthChart'
import { ChartCard } from '../../shared/components/ChartCard'
import { ExportButtons } from '../../../reports/shared/components/ExportButtons'
import {
  durationCellFromHours,
  exportToCsv,
  exportToXlsx,
  type ExportColumn,
  type ExportRow,
} from '../../../reports/shared/utils/exportTable'
import { formatPercent } from '../../../reports/shared/utils/formatters'
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
  // 134: duração calculável no arquivo. A ORIGEM aqui está em HORAS DECIMAIS
  // (`horasContratadas`/`horasConsumidas`), e a unidade canônica da linha é SEGUNDO
  // INTEIRO (analise-frontend §2.1) — por isso `durationCellFromHours`, nunca `durationCell`.
  { header: 'Horas do plano', key: 'horasPlano', type: 'duration' },
  { header: 'Horas usadas', key: 'horasUsadas', type: 'duration' },
  { header: 'Saúde', key: 'saude' },
]

/** Nomes de campo = os que o backend emite (`MetricsDtos.cs:120-126`) — ver 123/D4. */
function mapPlanToExportRow(item: PlanHealthItemDto): ExportRow {
  return {
    cliente: item.nomeFantasia ?? '—',
    plano: item.planNome ?? '—',
    consumo: formatPercent(item.percentualConsumo),
    // 134: o mapper para de pré-formatar e entrega o NÚMERO cru pelo helper do núcleo.
    // O guard de ausência (`== null`, `Number.isFinite`, clamp em 0) mora dentro dele —
    // o traço da coluna de texto continua, a hora ausente vira célula VAZIA (§6),
    // e o `0` legítimo continua sendo `0` (nunca ausência). Nada de conversão local.
    horasPlano: durationCellFromHours(item.horasContratadas),
    horasUsadas: durationCellFromHours(item.horasConsumidas),
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
