/**
 * Modal de drill-down da família TICKET (016) — retrocompatibilidade.
 *
 * Delega ao MetricDrillModal genérico, fornecendo as colunas de ticket e a navegação à
 * tela de detalhe do ticket (ticket-detail) pelo id INTERNO. Toda a infra (export do
 * conjunto filtrado, pausa do SSE, estados loading/erro/vazio) vive no modal genérico.
 *
 * AP-SECURITY-001: nenhuma coluna/título expõe categoria HubSpot. `status` é o label do pipeline.
 */

import { useNavigate } from '@tanstack/react-router'
import { MetricDrillModal } from './MetricDrillModal'
import { ticketDrillColumns } from '../utils/ticketDrillColumns'
import type {
  DrillSpec,
  MetricsBaseParams,
  TicketMetricKey,
  TicketRowDto,
} from '../types/metrics'
import type { useTicketDrill } from '../hooks/useTicketDrill'

type TicketDrillModalProps = {
  /** DrillSpec ativo — quando null o modal não é exibido. */
  activeDrill: DrillSpec | null
  onClose: () => void
  /** Hook de drill instanciado na página pai (compartilha baseParams). */
  drill: ReturnType<typeof useTicketDrill>
  /** Filtros/scope/período da tela — usados no export do conjunto filtrado completo. */
  baseParams: MetricsBaseParams
  /** Pausa SSE ao abrir (passar stream.pause). */
  onStreamPause?: () => void
  /** Retoma SSE ao fechar (passar stream.resume). */
  onStreamResume?: () => void
}

export function TicketDrillModal({
  activeDrill,
  onClose,
  drill,
  baseParams,
  onStreamPause,
  onStreamResume,
}: TicketDrillModalProps) {
  const navigate = useNavigate()

  const metric = (activeDrill?.metric ?? 'tickets-backlog') as TicketMetricKey
  const columns = ticketDrillColumns(metric)

  function handleRowClick(row: TicketRowDto) {
    // Drill até a raiz: navega à tela do ticket pelo id INTERNO (nunca HubSpot id na rota).
    void navigate({
      to: '/relatorios/tickets/$ticketId',
      params: { ticketId: String(row.ticketId) },
      search: { from: 'dashboard' },
    })
  }

  return (
    <MetricDrillModal<TicketRowDto>
      activeDrill={activeDrill}
      onClose={onClose}
      drill={drill}
      columns={columns}
      baseParams={baseParams}
      onRowClick={handleRowClick}
      exportFilename="drill-down-tickets"
      onStreamPause={onStreamPause}
      onStreamResume={onStreamResume}
    />
  )
}
