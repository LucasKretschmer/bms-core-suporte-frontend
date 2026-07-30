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
 *  - Descartado (120, D-1 — card dedicado, ver abaixo)
 *
 * D12 (demanda 119, esclarecimento definitivo de D3): soma de tempo e contagem de
 * lançamentos aplicam a regra canônica — `DesativadoEm IS NULL` (já garantido pelo
 * backend, que não retorna soft-deleted) e `Status <> CANCELLED`, incluindo RUNNING e
 * PAUSED. É o que faz este card bater com `totalSecondsAllTime`/`apontamentosCountAllTime`
 * da listagem "Apontamentos por Ticket" (arquitetura.md §7).
 * D14 (demanda 119, complementa D12): o card "Pausas" usa o MESMO conjunto canônico
 * (`workingEntries`) — todo agregado deste card compartilha o mesmo critério de
 * elegibilidade (AP-BACKEND-003), senão o card fica internamente inconsistente (pausas
 * de um apontamento cancelado contadas junto de lançamentos que o ignoram).
 *
 * 120/D-1: DISCARDED entra no MESMO critério de exclusão de CANCELLED (mesmo raciocínio
 * de D12, agora com 2 status não-elegíveis em vez de 1 — AP-BACKEND-003: numerador e
 * denominador com o mesmo critério). O tempo descartado NUNCA é somado silenciosamente
 * ao "Tempo total trabalhado" — é exibido à parte, no card "Descartado" (CORR-05/119:
 * "dado sumindo em silêncio" é o problema, não que ele deixe de contar como faturável).
 */
const NON_WORKING_STATUSES = ['CANCELLED', 'DISCARDED']

export function TicketKpiSummary({ entries }: TicketKpiSummaryProps) {
  const workingEntries = entries.filter((e) => !NON_WORKING_STATUSES.includes(e.status.toUpperCase()))
  const totalWork = workingEntries.reduce((acc, e) => acc + e.totalSeconds, 0)

  const pauseSegments = workingEntries.flatMap((e) =>
    e.segments.filter((s) => s.type === 'PAUSE'),
  )
  const pauseSeconds = pauseSegments.reduce((acc, s) => {
    const d = new Date(s.segmentEnd).getTime() - new Date(s.segmentStart).getTime()
    return acc + (Number.isNaN(d) || d < 0 ? 0 : Math.round(d / 1000))
  }, 0)

  const discardedEntries = entries.filter((e) => e.status.toUpperCase() === 'DISCARDED')
  const discardedSeconds = discardedEntries.reduce((acc, e) => acc + e.totalSeconds, 0)

  return (
    <section aria-label="Resumo do ticket">
      <KpiCardGrid className="md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-4">
        <KpiCard label="Lançamentos" value={workingEntries.length} />
        <KpiCard label="Tempo total trabalhado" value={formatSeconds(totalWork)} />
        <KpiCard
          label="Pausas"
          value={`${pauseSegments.length} · ${formatSeconds(pauseSeconds)}`}
        />
        <KpiCard
          label="Descartado"
          value={`${discardedEntries.length} · ${formatSeconds(discardedSeconds)}`}
          tooltipText="Apontamentos com tempo preservado, mas que não contam no tempo total trabalhado nem no faturamento (120)."
        />
      </KpiCardGrid>
    </section>
  )
}
