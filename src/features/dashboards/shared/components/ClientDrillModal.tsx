/**
 * Modal de drill-down da família CLIENTE (016 B3 — Saúde dos Planos).
 *
 * Delega ao MetricDrillModal genérico com as colunas de cliente. A linha navega à
 * tela do cliente (client-tickets) pelo id INTERNO (clientId), reusando a rota já
 * existente do drill de Consumo de Planos (com from='dashboard').
 */

import { useNavigate } from '@tanstack/react-router'
import { MetricDrillModal } from './MetricDrillModal'
import { clienteDrillColumns } from '../utils/clienteDrillColumns'
import type {
  ClientRowDto,
  DrillSpec,
  MetricsBaseParams,
} from '../types/metrics'
import type { UseMetricDrillReturn } from '../hooks/useMetricDrill'

type ClientDrillModalProps = {
  activeDrill: DrillSpec | null
  onClose: () => void
  drill: UseMetricDrillReturn<ClientRowDto>
  baseParams: MetricsBaseParams
  onStreamPause?: () => void
  onStreamResume?: () => void
}

export function ClientDrillModal({
  activeDrill,
  onClose,
  drill,
  baseParams,
  onStreamPause,
  onStreamResume,
}: ClientDrillModalProps) {
  const navigate = useNavigate()
  const columns = clienteDrillColumns()

  function handleRowClick(row: ClientRowDto) {
    // Drill até a raiz: tela do cliente pelo id INTERNO (client-tickets).
    void navigate({
      to: '/relatorios/clientes/$clientId',
      params: { clientId: String(row.clientId) },
      search: { from: 'dashboard' },
    })
  }

  return (
    <MetricDrillModal<ClientRowDto>
      activeDrill={activeDrill}
      onClose={onClose}
      drill={drill}
      columns={columns}
      baseParams={baseParams}
      onRowClick={handleRowClick}
      exportFilename="drill-down-clientes"
      onStreamPause={onStreamPause}
      onStreamResume={onStreamResume}
    />
  )
}
