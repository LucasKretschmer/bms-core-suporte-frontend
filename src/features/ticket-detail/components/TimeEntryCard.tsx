import { Badge } from '../../../components/ui/Badge'
import { formatDate, formatSeconds, formatTime } from '../../reports/shared/utils/formatters'
import { SegmentTimeline } from './SegmentTimeline'
import type { TicketTimeEntryDto } from '../types/ticketDetail'

type TimeEntryCardProps = {
  entry: TicketTimeEntryDto
  canEdit: boolean
  onEdit: (entry: TicketTimeEntryDto) => void
  /**
   * Pode gerir o ciclo de vida do apontamento (gestor — 099). Quando true, exibe
   * "Cancelar apontamento" em COMPLETED e "Restaurar" em CANCELLED.
   */
  canManage?: boolean
  /** Dispara o fluxo de cancelamento com motivo para este apontamento (099). */
  onCancel?: (entry: TicketTimeEntryDto) => void
  /** Dispara o fluxo de restauração (confirmação simples, sem motivo) (099). */
  onRestore?: (entry: TicketTimeEntryDto) => void
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

/** Ícone de "ban" (proibido) para a ação de cancelar apontamento. */
function BanIcon() {
  return (
    <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="9" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M5.6 5.6l12.8 12.8" />
    </svg>
  )
}

/** Ícone de "restaurar" (seta circular). */
function RestoreIcon() {
  return (
    <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h5M4 9a8 8 0 1 1 1.5 8" />
    </svg>
  )
}

/**
 * Card de um apontamento (NOVO — referência protótipo L543-552).
 * Header: agente + categorização + (badge "Faturável por fora").
 * Meta: data/hora início→fim + nº de pausas. Direita: tempo + link editar (canEdit).
 * Timeline proporcional + lista de segmentos detalhada + observação.
 *
 * Apontamentos CANCELLED permanecem visíveis com estilo discreto (099): badge
 * "Cancelado", motivo (note), quem cancelou (canceladoPorNome) e a ação "Restaurar".
 */
export function TimeEntryCard({
  entry,
  canEdit,
  onEdit,
  canManage = false,
  onCancel,
  onRestore,
}: TimeEntryCardProps) {
  const pauseCount = entry.segments.filter((s) => s.type === 'PAUSE').length
  const end = entry.endTime
  const crossesDay = end ? formatDate(entry.startTime) !== formatDate(end) : false

  const isCancelled = entry.status.toUpperCase() === 'CANCELLED'
  const isCompleted = entry.status.toUpperCase() === 'COMPLETED'

  const metaTime = end
    ? `${formatDate(entry.startTime)} · ${formatTime(entry.startTime)} → ${crossesDay ? `${formatDate(end)} ` : ''}${formatTime(end)}`
    : `${formatDate(entry.startTime)} · ${formatTime(entry.startTime)} → em aberto`

  const pauseLabel = pauseCount > 0 ? `${pauseCount} pausa(s)` : 'sem pausa'

  // Cancelados: card discreto (opacidade reduzida) para não competir com os ativos.
  const articleClass = isCancelled
    ? 'rounded-card border border-border bg-card p-4 opacity-70'
    : 'rounded-card border border-border bg-card p-4'

  return (
    <article className={articleClass}>
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
          <div className="mt-0.5 flex items-center justify-end gap-3">
            {/* Editar: bloqueado em cancelados (restaure antes de editar). */}
            {canEdit && !isCancelled && (
              <button
                type="button"
                onClick={() => onEdit(entry)}
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline rounded focus-visible:ring-2 focus-visible:ring-primary"
              >
                <EditIcon />
                editar
              </button>
            )}
            {/* Cancelar: só em COMPLETED e com permissão de gestor. */}
            {canManage && onCancel && isCompleted && (
              <button
                type="button"
                onClick={() => onCancel(entry)}
                aria-label="Cancelar apontamento"
                className="inline-flex items-center gap-1 text-xs text-error-fg hover:underline rounded focus-visible:ring-2 focus-visible:ring-primary"
              >
                <BanIcon />
                Cancelar apontamento
              </button>
            )}
            {/* Restaurar: só em CANCELLED e com permissão de gestor. */}
            {canManage && onRestore && isCancelled && (
              <button
                type="button"
                onClick={() => onRestore(entry)}
                aria-label="Restaurar apontamento"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline rounded focus-visible:ring-2 focus-visible:ring-primary"
              >
                <RestoreIcon />
                Restaurar
              </button>
            )}
          </div>
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
                      ? 'inline-flex items-center rounded-pill px-2 py-0.5 bg-badge-plano-bg text-badge-plano-fg font-medium'
                      : 'inline-flex items-center rounded-pill px-2 py-0.5 bg-badge-neutro-bg text-badge-neutro-fg font-medium'
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

      {/* Motivo do cancelamento + quem cancelou (099) — destacado nos cancelados. */}
      {isCancelled && (
        <div className="mt-2 rounded-input border border-border bg-badge-neutro-bg px-3 py-2 text-xs text-foreground/70">
          <span className="font-semibold">Cancelado</span>
          {entry.canceladoPorNome ? ` por ${entry.canceladoPorNome}` : ''}
          {entry.note ? ` · Motivo: ${entry.note}` : ''}
        </div>
      )}

      {/* Observação (apontamentos ativos — nos cancelados a nota vira o motivo acima). */}
      {!isCancelled && entry.note && (
        <p className="mt-2 text-sm text-foreground/80">
          <span className="font-semibold">Obs:</span> {entry.note}
        </p>
      )}
    </article>
  )
}
