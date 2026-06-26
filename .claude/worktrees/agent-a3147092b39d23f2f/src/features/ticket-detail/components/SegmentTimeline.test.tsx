import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SegmentTimeline } from './SegmentTimeline'
import type { TicketSegmentDto } from '../types/ticketDetail'

function seg(
  type: 'WORK' | 'PAUSE',
  start: string,
  end: string,
  id = `${type}-${start}`,
): TicketSegmentDto {
  return { id, type, segmentStart: start, segmentEnd: end }
}

describe('SegmentTimeline', () => {
  it('não renderiza quando o total é 0', () => {
    const { container } = render(
      <SegmentTimeline
        segments={[seg('WORK', '2026-06-19T08:00:00Z', '2026-06-19T08:00:00Z')]}
      />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('renderiza uma barra por segmento com larguras proporcionais (50/50)', () => {
    const { container } = render(
      <SegmentTimeline
        segments={[
          seg('WORK', '2026-06-19T08:00:00Z', '2026-06-19T09:00:00Z'),
          seg('WORK', '2026-06-19T09:00:00Z', '2026-06-19T10:00:00Z'),
        ]}
      />,
    )
    const root = container.firstChild as HTMLElement
    const bars = root.querySelectorAll(':scope > div')
    expect(bars).toHaveLength(2)
    expect((bars[0] as HTMLElement).style.width).toBe('50%')
    expect((bars[1] as HTMLElement).style.width).toBe('50%')
  })

  it('aplica classe azul para WORK e fundo listrado para PAUSE', () => {
    const { container } = render(
      <SegmentTimeline
        segments={[
          seg('WORK', '2026-06-19T08:00:00Z', '2026-06-19T09:00:00Z'),
          seg('PAUSE', '2026-06-19T09:00:00Z', '2026-06-19T09:30:00Z'),
        ]}
      />,
    )
    const root = container.firstChild as HTMLElement
    const bars = root.querySelectorAll(':scope > div')
    expect((bars[0] as HTMLElement).className).toContain('bg-primary')
    // PAUSE usa backgroundImage (listrado) em vez de bg-primary.
    expect((bars[1] as HTMLElement).style.backgroundImage).toContain('repeating-linear-gradient')
  })

  it('expõe role=img com aria-label resumindo trabalhos e pausas', () => {
    render(
      <SegmentTimeline
        segments={[
          seg('WORK', '2026-06-19T08:00:00Z', '2026-06-19T09:00:00Z'),
          seg('PAUSE', '2026-06-19T09:00:00Z', '2026-06-19T09:30:00Z'),
        ]}
      />,
    )
    expect(screen.getByRole('img')).toHaveAttribute(
      'aria-label',
      'Linha do tempo: 1 trabalho(s), 1 pausa(s)',
    )
  })
})
