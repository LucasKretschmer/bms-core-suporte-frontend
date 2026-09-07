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

  it('variante recuada troca as DUAS barras (trabalho e vazio da pausa), sem opacidade', () => {
    const { container } = render(
      <SegmentTimeline
        variante="recuada"
        segments={[
          seg('WORK', '2026-06-19T08:00:00Z', '2026-06-19T09:00:00Z'),
          seg('PAUSE', '2026-06-19T09:00:00Z', '2026-06-19T09:30:00Z'),
        ]}
      />,
    )
    const root = container.firstChild as HTMLElement
    const bars = Array.from(root.querySelectorAll(':scope > div')) as HTMLElement[]
    // Trabalho: `bg-primary` cheio (L = 0,0246) seria ~5x mais pesado do que a tela mostra
    // hoje; `bg-muted` tem a luminância do composto que o `opacity-70` produzia.
    expect(bars[0].className).toContain('bg-muted')
    expect(bars[0].className).not.toContain('bg-primary')
    // Pausa: o "vazio" inverte, senão some contra um card que agora É `--color-background`.
    expect(bars[1].className).toContain('bg-card')
    expect(bars[1].className).not.toContain('bg-background')
    expect(bars[1].style.backgroundImage).toContain('repeating-linear-gradient')
    // O recuo é por superfície — nenhum `opacity-*` voltou por esta porta.
    for (const barra of [root, ...bars]) {
      expect(barra.className).not.toMatch(/\bopacity-\d+\b/)
    }
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
