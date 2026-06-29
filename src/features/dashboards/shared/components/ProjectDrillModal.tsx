/**
 * Modal de drill-down da família PROJETO (016 B4 — Onboarding).
 *
 * Delega ao MetricDrillModal genérico com as colunas de projeto. R5: NÃO passa onRowClick
 * — não existe tela de detalhe de projeto, então a linha não é clicável (cursor default).
 */

import { MetricDrillModal } from './MetricDrillModal'
import { projetoDrillColumns } from '../utils/projetoDrillColumns'
import type {
  DrillSpec,
  MetricsBaseParams,
  ProjectRowDto,
} from '../types/metrics'
import type { UseMetricDrillReturn } from '../hooks/useMetricDrill'

type ProjectDrillModalProps = {
  activeDrill: DrillSpec | null
  onClose: () => void
  drill: UseMetricDrillReturn<ProjectRowDto>
  baseParams: MetricsBaseParams
  onStreamPause?: () => void
  onStreamResume?: () => void
}

export function ProjectDrillModal({
  activeDrill,
  onClose,
  drill,
  baseParams,
  onStreamPause,
  onStreamResume,
}: ProjectDrillModalProps) {
  const columns = projetoDrillColumns()

  // R5: sem onRowClick — a linha não navega (não há project-detail).
  return (
    <MetricDrillModal<ProjectRowDto>
      activeDrill={activeDrill}
      onClose={onClose}
      drill={drill}
      columns={columns}
      baseParams={baseParams}
      exportFilename="drill-down-projetos"
      onStreamPause={onStreamPause}
      onStreamResume={onStreamResume}
    />
  )
}
