import { KpiCard } from '../../dashboards/shared/components/KpiCard'
import { KpiCardGrid } from '../../dashboards/shared/components/KpiCardGrid'
import { formatSeconds } from '../../reports/shared/utils/formatters'
import type { TicketTimeEntryDto } from '../types/ticketDetail'

type TicketKpiSummaryProps = {
  entries: TicketTimeEntryDto[]
}

/**
 * KPIs do detalhe (referência protótipo L563-567):
 *  - Lançamentos (qtde de apontamentos)
 *  - Tempo total trabalhado (soma de totalSeconds — fonte de verdade do DTO)
 *  - Pausas (nº de PAUSE · tempo de pausa)
 */
export function TicketKpiSummary({ entries }: TicketKpiSummaryProps) {
  const totalWork = entries.reduce((acc, e) => acc + e.totalSeconds, 0)

  const pauseSegments = entries.flatMap((e) =>
    e.segments.filter((s) => s.type === 'PAUSE'),
  )
  const pauseSeconds = pauseSegments.reduce((acc, s) => {
    const d = new Date(s.segmentEnd).getTime() - new Date(s.segmentStart).getTime()
    return acc + (Number.isNaN(d) || d < 0 ? 0 : Math.round(d / 1000))
  }, 0)

  return (
    <section aria-label="Resumo do ticket">
      <KpiCardGrid className="md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-3">
        <KpiCard label="Lançamentos" value={entries.length} />
        <KpiCard label="Tempo total trabalhado" value={formatSeconds(totalWork)} />
        <KpiCard
          label="Pausas"
          value={`${pauseSegments.length} · ${formatSeconds(pauseSeconds)}`}
        />
      </KpiCardGrid>
    </section>
  )
}
