import { Badge } from '../../../components/ui/Badge'
import { formatDate, formatSeconds, formatTime } from '../../reports/shared/utils/formatters'
import { SegmentTimeline } from './SegmentTimeline'
import type { TicketTimeEntryDto } from '../types/ticketDetail'

type TimeEntryCardProps = {
  entry: TicketTimeEntryDto
  canEdit: boolean
  onEdit: (entry: TicketTimeEntryDto) => void
}

/**
 * Rótulos legíveis em PT para o status do atendimento.
 * Chaves normalizadas em UPPERCASE; cobre RUNNING|PAUSED|COMPLETED|CANCELLED.
 */
const STATUS_LABELS: Record<string, string> = {
  RUNNING: 'Em andamento',
  PAUSED: 'Pausado',
  COMPLETED: 'Concluído',
  CANCELLED: 'Cancelado',
}

/** Mapeia o status bruto do apontamento para o rótulo PT (fallback: valor original). */
function statusLabel(status: string): string {
  return STATUS_LABELS[status.toUpperCase()] ?? status
}

function EditIcon() {
  return (
    <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  )
}

/**
 * Card de um apontamento (NOVO — referência protótipo L543-552).
 * Header: agente + categorização + (badge "Faturável por fora").
 * Meta: data/hora início→fim + nº de pausas. Direita: tempo + link editar (canEdit).
 * Timeline proporcional + lista de segmentos detalhada + observação.
 */
export function TimeEntryCard({ entry, canEdit, onEdit }: TimeEntryCardProps) {
  const pauseCount = entry.segments.filter((s) => s.type === 'PAUSE').length
  const end = entry.endTime
  const crossesDay = end ? formatDate(entry.startTime) !== formatDate(end) : false

  const metaTime = end
    ? `${formatDate(entry.startTime)} · ${formatTime(entry.startTime)} → ${crossesDay ? `${formatDate(end)} ` : ''}${formatTime(end)}`
    : `${formatDate(entry.startTime)} · ${formatTime(entry.startTime)} → em aberto`

  const pauseLabel = pauseCount > 0 ? `${pauseCount} pausa(s)` : 'sem pausa'

  return (
    <article className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-foreground">
              {entry.agenteNome?.trim() ? entry.agenteNome : 'Atendente não informado'}
            </span>
            {entry.status && <Badge value={statusLabel(entry.status)} />}
            {entry.categorizacaoNome && <Badge value={entry.categorizacaoNome} />}
            {entry.billableOutsidePlan && <Badge value="Faturável por fora" />}
          </div>
          <p className="mt-1 text-xs text-foreground/50">
            {metaTime} · {pauseLabel}
          </p>
        </div>

        <div className="text-right shrink-0">
          <div className="text-lg font-semibold text-foreground">
            {formatSeconds(entry.totalSeconds)}
          </div>
          {canEdit && (
            <button
              type="button"
              onClick={() => onEdit(entry)}
              className="mt-0.5 inline-flex items-center gap-1 text-xs text-primary hover:underline rounded focus-visible:ring-2 focus-visible:ring-primary"
            >
              <EditIcon />
              editar
            </button>
          )}
        </div>
      </div>

      {/* Timeline proporcional */}
      <SegmentTimeline segments={entry.segments} className="mt-3" />

      {/* Segmentos detalhados */}
      {entry.segments.length > 0 && (
        <ul className="mt-2 space-y-1">
          {entry.segments.map((s, idx) => {
            const durMs = new Date(s.segmentEnd).getTime() - new Date(s.segmentStart).getTime()
            const durSec = Number.isNaN(durMs) || durMs < 0 ? 0 : Math.round(durMs / 1000)
            const isWork = s.type === 'WORK'
            return (
              <li key={s.id ?? idx} className="flex items-center gap-2 text-xs text-foreground/70">
                <span
                  className={
                    isWork
                      ? 'inline-flex items-center rounded-full px-2 py-0.5 bg-badge-plano-bg text-badge-plano-fg font-medium'
                      : 'inline-flex items-center rounded-full px-2 py-0.5 bg-badge-neutro-bg text-badge-neutro-fg font-medium'
                  }
                >
                  {isWork ? 'Trabalho' : 'Pausa'}
                </span>
                <span>
                  {formatTime(s.segmentStart)} → {formatTime(s.segmentEnd)}
                </span>
                <span className="text-foreground/40">· {formatSeconds(durSec)}</span>
              </li>
            )
          })}
        </ul>
      )}

      {/* Observação */}
      {entry.note && (
        <p className="mt-2 text-sm text-foreground/80">
          <span className="font-semibold">Obs:</span> {entry.note}
        </p>
      )}
    </article>
  )
}
