import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { TicketKpiSummary } from './TicketKpiSummary'
import type { TicketTimeEntryDto } from '../types/ticketDetail'

/** Escopa a busca ao card de KPI pelo label (evita colisão quando "Pausas" e "Descartado"
 * mostram o mesmo texto "0 · 0h 0m" — ambos zerados). */
function kpiCard(label: string): HTMLElement {
  const card = screen.getByText(label).closest('div.rounded-card')
  if (!card) throw new Error(`Card "${label}" não encontrado`)
  return card as HTMLElement
}

function entry(overrides: Partial<TicketTimeEntryDto> = {}): TicketTimeEntryDto {
  return {
    id: 1,
    userId: 1,
    agenteNome: 'Maria',
    serviceCategoryId: 2,
    categorizacaoNome: 'Consultoria',
    billableOutsidePlan: false,
    status: 'COMPLETED',
    startTime: '2026-06-19T11:00:00Z',
    endTime: '2026-06-19T12:00:00Z',
    totalSeconds: 3600,
    note: null,
    pendingCategory: false,
    canceladoPorUserId: null,
    canceladoPorNome: null,
    segments: [],
    ...overrides,
  }
}

describe('TicketKpiSummary', () => {
  it('D12: soma e conta apenas os NÃO cancelados — 1 completed + 1 running + 1 cancelled', () => {
    const entries: TicketTimeEntryDto[] = [
      entry({ id: 1, status: 'COMPLETED', totalSeconds: 3600 }), // 1h
      entry({ id: 2, status: 'RUNNING', totalSeconds: 600 }), // 10min
      entry({ id: 3, status: 'CANCELLED', totalSeconds: 999999 }), // deve ser ignorado
    ]

    render(<TicketKpiSummary entries={entries} />)

    // Lançamentos = 2 (ignora o cancelado)
    expect(screen.getByText('Lançamentos')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()

    // Tempo total trabalhado = 3600 + 600 = 4200s = 1h 10m (ignora o cancelado)
    expect(screen.getByText('1h 10m')).toBeInTheDocument()
  })

  it('inclui PAUSED na soma e na contagem (D12 — só exclui CANCELLED)', () => {
    const entries: TicketTimeEntryDto[] = [
      entry({ id: 1, status: 'PAUSED', totalSeconds: 1800 }), // 30min
      entry({ id: 2, status: 'CANCELLED', totalSeconds: 7200 }),
    ]

    render(<TicketKpiSummary entries={entries} />)

    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('0h 30m')).toBeInTheDocument()
  })

  it('lista só com CANCELLED → Lançamentos = 0 e Tempo total = 0h 0m (não quebra)', () => {
    const entries: TicketTimeEntryDto[] = [
      entry({ id: 1, status: 'CANCELLED', totalSeconds: 5000 }),
    ]

    render(<TicketKpiSummary entries={entries} />)

    expect(screen.getByText('Lançamentos')).toBeInTheDocument()
    expect(screen.getByText('0')).toBeInTheDocument()
    expect(screen.getByText('0h 0m')).toBeInTheDocument()
  })

  it('lista vazia → Lançamentos = 0 e Tempo total = 0h 0m (não regride o caso já coberto hoje)', () => {
    render(<TicketKpiSummary entries={[]} />)

    expect(screen.getByText('Lançamentos')).toBeInTheDocument()
    expect(screen.getByText('0')).toBeInTheDocument()
    expect(screen.getByText('0h 0m')).toBeInTheDocument()
  })

  it('status em lowercase também é reconhecido como cancelado (normalização defensiva)', () => {
    const entries: TicketTimeEntryDto[] = [
      entry({ id: 1, status: 'COMPLETED', totalSeconds: 1000 }),
      entry({ id: 2, status: 'cancelled', totalSeconds: 5000 }),
    ]

    render(<TicketKpiSummary entries={entries} />)

    expect(screen.getByText('Lançamentos')).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()
  })

  it('D14: pausas do apontamento CANCELLED são ignoradas — conta só as do não-cancelado', () => {
    const entries: TicketTimeEntryDto[] = [
      entry({
        id: 1,
        status: 'COMPLETED',
        totalSeconds: 3600,
        segments: [
          { id: 10, type: 'PAUSE', segmentStart: '2026-06-19T11:00:00Z', segmentEnd: '2026-06-19T11:10:00Z' }, // 10min
        ],
      }),
      entry({
        id: 2,
        status: 'CANCELLED',
        totalSeconds: 7200,
        segments: [
          { id: 20, type: 'PAUSE', segmentStart: '2026-06-19T09:00:00Z', segmentEnd: '2026-06-19T09:10:00Z' }, // 10min
          { id: 21, type: 'PAUSE', segmentStart: '2026-06-19T09:20:00Z', segmentEnd: '2026-06-19T09:30:00Z' }, // 10min
        ],
      }),
    ]

    render(<TicketKpiSummary entries={entries} />)

    // Só a 1 pausa do apontamento não-cancelado é contada (as 2 do cancelado são ignoradas).
    expect(screen.getByText('1 · 0h 10m')).toBeInTheDocument()
  })

  it('D14: apontamento cancelado é o ÚNICO com pausas → card "Pausas" mostra 0 (não vaza pausa do cancelado)', () => {
    const entries: TicketTimeEntryDto[] = [
      entry({ id: 1, status: 'COMPLETED', totalSeconds: 1000, segments: [] }),
      entry({
        id: 2,
        status: 'CANCELLED',
        totalSeconds: 9999,
        segments: [
          { id: 30, type: 'PAUSE', segmentStart: '2026-06-19T09:00:00Z', segmentEnd: '2026-06-19T09:15:00Z' }, // 15min
        ],
      }),
    ]

    render(<TicketKpiSummary entries={entries} />)

    expect(within(kpiCard('Pausas')).getByText('0 · 0h 0m')).toBeInTheDocument()
  })

  describe('120/D-1: status DISCARDED — excluído de Lançamentos/Tempo total, card dedicado', () => {
    it('entries com COMPLETED + RUNNING + CANCELLED + DISCARDED — Lançamentos/Tempo total contam só os 2 primeiros', () => {
      const entries: TicketTimeEntryDto[] = [
        entry({ id: 1, status: 'COMPLETED', totalSeconds: 1800 }), // 30min
        entry({ id: 2, status: 'RUNNING', totalSeconds: 600 }), // 10min
        entry({ id: 3, status: 'CANCELLED', totalSeconds: 5000 }),
        entry({ id: 4, status: 'DISCARDED', totalSeconds: 999999 }),
      ]

      render(<TicketKpiSummary entries={entries} />)

      // Lançamentos = 2 (só COMPLETED + RUNNING)
      expect(screen.getByText('Lançamentos')).toBeInTheDocument()
      expect(screen.getByText('2')).toBeInTheDocument()
      // Tempo total trabalhado = 1800 + 600 = 2400s = 0h 40m (não soma o DISCARDED)
      expect(screen.getByText('0h 40m')).toBeInTheDocument()
    })

    it('novo card "Descartado": 2 entries DISCARDED (1800s + 900s) + 1 COMPLETED → "2 · 0h 45m"', () => {
      const entries: TicketTimeEntryDto[] = [
        entry({ id: 1, status: 'COMPLETED', totalSeconds: 1000 }),
        entry({ id: 2, status: 'DISCARDED', totalSeconds: 1800 }),
        entry({ id: 3, status: 'DISCARDED', totalSeconds: 900 }),
      ]

      render(<TicketKpiSummary entries={entries} />)

      expect(screen.getByText('Descartado')).toBeInTheDocument()
      expect(screen.getByText('2 · 0h 45m')).toBeInTheDocument()
      // Lançamentos/Tempo total NÃO incluem os 2 descartados
      expect(screen.getByText('1')).toBeInTheDocument()
      expect(screen.getByText('0h 16m')).toBeInTheDocument() // 1000s
    })

    it('entries só com DISCARDED → Lançamentos=0, Tempo total="0h 0m", Descartado="1 · Xh Ym"', () => {
      const entries: TicketTimeEntryDto[] = [
        entry({ id: 1, status: 'DISCARDED', totalSeconds: 3661 }), // 1h 1m
      ]

      render(<TicketKpiSummary entries={entries} />)

      expect(screen.getByText('Lançamentos')).toBeInTheDocument()
      expect(screen.getByText('0')).toBeInTheDocument()
      expect(screen.getByText('0h 0m')).toBeInTheDocument()
      expect(screen.getByText('1 · 1h 1m')).toBeInTheDocument()
    })

    it('pausas do apontamento DISCARDED são ignoradas no card "Pausas" (mesmo racional de D14)', () => {
      const entries: TicketTimeEntryDto[] = [
        entry({ id: 1, status: 'COMPLETED', totalSeconds: 1000, segments: [] }),
        entry({
          id: 2,
          status: 'DISCARDED',
          totalSeconds: 9999,
          segments: [
            { id: 40, type: 'PAUSE', segmentStart: '2026-06-19T09:00:00Z', segmentEnd: '2026-06-19T09:20:00Z' }, // 20min
          ],
        }),
      ]

      render(<TicketKpiSummary entries={entries} />)

      expect(screen.getByText('0 · 0h 0m')).toBeInTheDocument()
    })

    it('lista vazia → 4 cards, todos zerados', () => {
      render(<TicketKpiSummary entries={[]} />)

      expect(screen.getByText('Lançamentos')).toBeInTheDocument()
      expect(screen.getByText('Tempo total trabalhado')).toBeInTheDocument()
      expect(screen.getByText('Pausas')).toBeInTheDocument()
      expect(screen.getByText('Descartado')).toBeInTheDocument()
      expect(screen.getByText('0')).toBeInTheDocument()
      expect(screen.getByText('0h 0m')).toBeInTheDocument()
      expect(screen.getAllByText('0 · 0h 0m').length).toBe(2) // Pausas + Descartado
    })
  })
})
