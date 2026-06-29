/**
 * Modal de drill-down da família APONTAMENTO (016 B1).
 *
 * Delega ao MetricDrillModal genérico com as colunas de apontamento. A linha navega à
 * tela do TICKET do apontamento (apontamento não tem tela própria) pelo id INTERNO.
 */

import { useNavigate } from '@tanstack/react-router'
import { MetricDrillModal } from './MetricDrillModal'
import { apontamentoDrillColumns } from '../utils/apontamentoDrillColumns'
import type {
  DrillSpec,
  MetricsBaseParams,
  TimeEntryDrillRowDto,
} from '../types/metrics'
import type { UseMetricDrillReturn } from '../hooks/useMetricDrill'

type ApontamentoDrillModalProps = {
  activeDrill: DrillSpec | null
  onClose: () => void
  drill: UseMetricDrillReturn<TimeEntryDrillRowDto>
  baseParams: MetricsBaseParams
  onStreamPause?: () => void
  onStreamResume?: () => void
}

export function ApontamentoDrillModal({
  activeDrill,
  onClose,
  drill,
  baseParams,
  onStreamPause,
  onStreamResume,
}: ApontamentoDrillModalProps) {
  const navigate = useNavigate()
  const columns = apontamentoDrillColumns()

  function handleRowClick(row: TimeEntryDrillRowDto) {
    // Apontamento não tem tela própria → navega ao ticket do apontamento (id interno).
    void navigate({
      to: '/relatorios/tickets/$ticketId',
      params: { ticketId: String(row.ticketId) },
      search: { from: 'dashboard' },
    })
  }

  return (
    <MetricDrillModal<TimeEntryDrillRowDto>
      activeDrill={activeDrill}
      onClose={onClose}
      drill={drill}
      columns={columns}
      baseParams={baseParams}
      onRowClick={handleRowClick}
      exportFilename="drill-down-apontamentos"
      onStreamPause={onStreamPause}
      onStreamResume={onStreamResume}
    />
  )
}
