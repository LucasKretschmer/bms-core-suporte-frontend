import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { TimeEntryCard } from './TimeEntryCard'
import type { TicketTimeEntryDto } from '../types/ticketDetail'

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
    segments: [
      { id: 10, type: 'WORK', segmentStart: '2026-06-19T11:00:00Z', segmentEnd: '2026-06-19T12:00:00Z' },
    ],
    ...overrides,
  }
}

describe('TimeEntryCard', () => {
  it('mostra o badge "Faturável por fora" quando billableOutsidePlan=true', () => {
    render(<TimeEntryCard entry={entry({ billableOutsidePlan: true })} canEdit={false} onEdit={vi.fn()} />)
    expect(screen.getByText('Faturável por fora')).toBeInTheDocument()
  })

  it('não mostra o badge "Faturável por fora" quando false', () => {
    render(<TimeEntryCard entry={entry({ billableOutsidePlan: false })} canEdit={false} onEdit={vi.fn()} />)
    expect(screen.queryByText('Faturável por fora')).not.toBeInTheDocument()
  })

  it('oculta o link editar quando canEdit=false', () => {
    render(<TimeEntryCard entry={entry()} canEdit={false} onEdit={vi.fn()} />)
    expect(screen.queryByText('editar')).not.toBeInTheDocument()
  })

  it('mostra e dispara onEdit quando canEdit=true', async () => {
    const onEdit = vi.fn()
    render(<TimeEntryCard entry={entry()} canEdit onEdit={onEdit} />)
    await userEvent.click(screen.getByText('editar'))
    expect(onEdit).toHaveBeenCalledTimes(1)
  })

  it('mostra "sem pausa" quando não há segmento PAUSE', () => {
    render(<TimeEntryCard entry={entry()} canEdit={false} onEdit={vi.fn()} />)
    expect(screen.getByText(/sem pausa/)).toBeInTheDocument()
  })

  it('mostra "N pausa(s)" quando há segmentos PAUSE', () => {
    render(
      <TimeEntryCard
        canEdit={false}
        onEdit={vi.fn()}
        entry={entry({
          segments: [
            { id: 's1', type: 'WORK', segmentStart: '2026-06-19T11:00:00Z', segmentEnd: '2026-06-19T11:30:00Z' },
            { id: 's2', type: 'PAUSE', segmentStart: '2026-06-19T11:30:00Z', segmentEnd: '2026-06-19T11:40:00Z' },
            { id: 's3', type: 'WORK', segmentStart: '2026-06-19T11:40:00Z', segmentEnd: '2026-06-19T12:00:00Z' },
          ],
        })}
      />,
    )
    expect(screen.getByText(/1 pausa\(s\)/)).toBeInTheDocument()
  })

  it('renderiza a observação quando presente', () => {
    render(<TimeEntryCard entry={entry({ note: 'Atendimento concluído' })} canEdit={false} onEdit={vi.fn()} />)
    expect(screen.getByText(/Atendimento concluído/)).toBeInTheDocument()
  })
})
