import { clsx } from 'clsx'
import { formatSeconds, formatTime } from '../../reports/shared/utils/formatters'
import type { TicketSegmentDto } from '../types/ticketDetail'

type SegmentTimelineProps = {
  segments: TicketSegmentDto[]
  className?: string
}

/**
 * Linha do tempo proporcional dos segmentos de um apontamento (NOVO).
 * WORK = azul (bg-primary); PAUSE = listrado (gradiente) — distingue sem depender
 * só de cor (WCAG). Cada barra recebe width = duração / total.
 * total === 0 → não renderiza (evita divisão por zero).
 */
export function SegmentTimeline({ segments, className }: SegmentTimelineProps) {
  const durations = segments.map((s) => {
    const d = new Date(s.segmentEnd).getTime() - new Date(s.segmentStart).getTime()
    return Number.isNaN(d) || d < 0 ? 0 : d
  })
  const total = durations.reduce((a, d) => a + d, 0)

  if (total === 0) return null

  const workCount = segments.filter((s) => s.type === 'WORK').length
  const pauseCount = segments.length - workCount
  const ariaLabel = `Linha do tempo: ${workCount} trabalho(s), ${pauseCount} pausa(s)`

  return (
    <div
      role="img"
      aria-label={ariaLabel}
      className={clsx('flex h-2.5 w-full overflow-hidden rounded', className)}
    >
      {segments.map((s, idx) => {
        const widthPct = (durations[idx] / total) * 100
        const isWork = s.type === 'WORK'
        const durationSec = Math.round(durations[idx] / 1000)
        const title = `${isWork ? 'Trabalho' : 'Pausa'} ${formatTime(s.segmentStart)}→${formatTime(s.segmentEnd)} · ${formatSeconds(durationSec)}`
        return (
          <div
            key={s.id ?? idx}
            title={title}
            style={
              isWork
                ? { width: `${widthPct}%` }
                : {
                    width: `${widthPct}%`,
                    backgroundImage:
                      'repeating-linear-gradient(45deg, var(--color-border) 0, var(--color-border) 3px, transparent 3px, transparent 6px)',
                  }
            }
            className={clsx('h-full', isWork ? 'bg-primary' : 'bg-background')}
          />
        )
      })}
    </div>
  )
}
