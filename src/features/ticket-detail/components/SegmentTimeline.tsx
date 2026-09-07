import { clsx } from 'clsx'
import { formatSeconds, formatTime } from '../../reports/shared/utils/formatters'
import type { TicketSegmentDto } from '../types/ticketDetail'

type SegmentTimelineProps = {
  segments: TicketSegmentDto[]
  className?: string
  /**
   * Superfície do card que hospeda a linha do tempo (125/`Q-1`).
   *
   * - `padrao` — card `--color-card` (#ffffff): trabalho em `bg-primary` (#002f4f), pausa
   *   "vazada" em `bg-background` (#f0f4f7).
   * - `recuada` — card CANCELADO, que passou a recuar por fundo próprio
   *   `--color-background` (#f0f4f7) em vez de `opacity-70`. Duas coisas mudam, e as duas
   *   têm motivo medido:
   *
   *   1. **O vazio da pausa inverte para `bg-card`.** `bg-background` sobre um card
   *      `bg-background` é a mesma cor — o trecho de pausa sumiria, restando só as listras.
   *   2. **A barra de trabalho vira `bg-muted`.** Com `opacity-70` no card, o `bg-primary`
   *      era composto sobre a página e chegava ao olho como #486a81, de luminância
   *      relativa 0,1328. Sem o grupo, o `bg-primary` cheio (L = 0,0246) ficaria ~5× mais
   *      pesado que hoje e seria o elemento mais forte de um card que deveria recuar.
   *      `--color-muted` (#666666) tem L = 0,1329 — praticamente a MESMA luminância do que
   *      a tela já mostra hoje —, mede 5,20:1 contra o card (piso não-textual 3:1) e é
   *      acromático, então nunca compete com o azul dos apontamentos válidos.
   *
   * Em nenhum dos dois casos há `opacity-*`: o recuo é por superfície, que é exatamente a
   * causa que `Q-1` eliminou.
   */
  variante?: 'padrao' | 'recuada'
}

/**
 * Linha do tempo proporcional dos segmentos de um apontamento (NOVO).
 * WORK = azul (bg-primary); PAUSE = listrado (gradiente) — distingue sem depender
 * só de cor (WCAG). Cada barra recebe width = duração / total.
 * total === 0 → não renderiza (evita divisão por zero).
 */
export function SegmentTimeline({
  segments,
  className,
  variante = 'padrao',
}: SegmentTimelineProps) {
  const durations = segments.map((s) => {
    const d = new Date(s.segmentEnd).getTime() - new Date(s.segmentStart).getTime()
    return Number.isNaN(d) || d < 0 ? 0 : d
  })
  const total = durations.reduce((a, d) => a + d, 0)

  if (total === 0) return null

  const recuada = variante === 'recuada'
  // Uma variável por papel — trabalho e "vazio" da pausa — governa as duas barras. Trocar
  // uma e esquecer a outra foi como o `/40` da lista de segmentos sobreviveu a uma correção
  // anterior deste mesmo card (125/FE-A11Y-2 → `-3`).
  const barraDeTrabalho = recuada ? 'bg-muted' : 'bg-primary'
  const barraDePausa = recuada ? 'bg-card' : 'bg-background'

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
            className={clsx('h-full', isWork ? barraDeTrabalho : barraDePausa)}
          />
        )
      })}
    </div>
  )
}
