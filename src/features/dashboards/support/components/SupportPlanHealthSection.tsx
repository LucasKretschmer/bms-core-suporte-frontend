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
import { useToast } from '../../../../components/ui/Toast'
import type { PlanHealthItemDto } from '../../shared/types/metrics'

type SupportPlanHealthSectionProps = {
  from: string | null
  to: string | null
  clientId?: string | null
  planId?: string | null
}

const FAIXA_LABEL: Record<PlanHealthItemDto['faixaSaude'], string> = {
  verde: 'Ok (< 80%)',
  amarelo: 'Atenção (80–95%)',
  vermelho: 'Crítico (≥ 95%)',
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

function mapPlanToExportRow(item: PlanHealthItemDto): ExportRow {
  return {
    cliente: item.nomeCliente ?? '—',
    plano: item.nomePlano ?? '—',
    consumo: formatPercent(item.percentualConsumo),
    horasPlano: formatHours(item.horasPlano),
    horasUsadas: formatHours(item.horasUsadas),
    saude: FAIXA_LABEL[item.faixaSaude] ?? item.faixaSaude,
  }
}

export function SupportPlanHealthSection({
  from,
  to,
  clientId,
  planId,
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
  const isEmpty = !isLoading && !isError && !summary
  const canExport = !isLoading && !isError && planos.length > 0

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
      <PlanHealthChart summary={summary} height={220} />
    </ChartCard>
  )
}
