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
    canceladoPorUserId: null,
    canceladoPorNome: null,
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

  it('oculta "Cancelar apontamento" quando canManage=false (não-gestor)', () => {
    render(<TimeEntryCard entry={entry()} canEdit={false} onEdit={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.queryByText('Cancelar apontamento')).not.toBeInTheDocument()
  })

  it('mostra e dispara onCancel em COMPLETED sem tempo consolidado quando canManage=true (gestor)', async () => {
    const onCancel = vi.fn()
    render(
      <TimeEntryCard
        entry={entry({ totalSeconds: 0 })}
        canEdit={false}
        onEdit={vi.fn()}
        canManage
        onCancel={onCancel}
      />,
    )
    await userEvent.click(screen.getByText('Cancelar apontamento'))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('não renderiza "Cancelar apontamento" quando canManage=true mas sem onCancel', () => {
    render(<TimeEntryCard entry={entry()} canEdit={false} onEdit={vi.fn()} canManage />)
    expect(screen.queryByText('Cancelar apontamento')).not.toBeInTheDocument()
  })

  it('não mostra "Cancelar apontamento" em apontamento não-COMPLETED', () => {
    render(
      <TimeEntryCard
        entry={entry({ status: 'RUNNING', endTime: null })}
        canEdit={false}
        onEdit={vi.fn()}
        canManage
        onCancel={vi.fn()}
      />,
    )
    expect(screen.queryByText('Cancelar apontamento')).not.toBeInTheDocument()
  })

  it('em CANCELLED mostra "Restaurar", o motivo e quem cancelou (canManage)', async () => {
    const onRestore = vi.fn()
    render(
      <TimeEntryCard
        entry={entry({
          status: 'CANCELLED',
          note: 'Lançamento em duplicidade',
          canceladoPorNome: 'João Gestor',
        })}
        canEdit
        onEdit={vi.fn()}
        canManage
        onCancel={vi.fn()}
        onRestore={onRestore}
      />,
    )
    // Restaurar aparece; Cancelar apontamento não (não é COMPLETED).
    expect(screen.queryByText('Cancelar apontamento')).not.toBeInTheDocument()
    expect(screen.getByText(/Lançamento em duplicidade/)).toBeInTheDocument()
    expect(screen.getByText(/João Gestor/)).toBeInTheDocument()
    // Editar é bloqueado em cancelados.
    expect(screen.queryByText('editar')).not.toBeInTheDocument()

    await userEvent.click(screen.getByText('Restaurar'))
    expect(onRestore).toHaveBeenCalledTimes(1)
  })

  it('oculta "Restaurar" em CANCELLED quando canManage=false', () => {
    render(
      <TimeEntryCard
        entry={entry({ status: 'CANCELLED' })}
        canEdit={false}
        onEdit={vi.fn()}
        onRestore={vi.fn()}
      />,
    )
    expect(screen.queryByText('Restaurar')).not.toBeInTheDocument()
  })

  describe('DISCARDED (120, D-1)', () => {
    it('NÃO aplica opacity-70 (diferente de CANCELLED — tempo real, não some da tela)', () => {
      const { container } = render(
        <TimeEntryCard
          entry={entry({ status: 'DISCARDED', totalSeconds: 3600 })}
          canEdit={false}
          onEdit={vi.fn()}
        />,
      )
      expect(container.querySelector('article')?.className).not.toContain('opacity-70')
    })

    it('CANCELLED continua aplicando opacity-70 (não regride)', () => {
      const { container } = render(
        <TimeEntryCard
          entry={entry({ status: 'CANCELLED', totalSeconds: 0 })}
          canEdit={false}
          onEdit={vi.fn()}
        />,
      )
      expect(container.querySelector('article')?.className).toContain('opacity-70')
    })

    it('mostra "Restaurar" quando canManage=true (mesmo gate do CANCELLED)', async () => {
      const onRestore = vi.fn()
      render(
        <TimeEntryCard
          entry={entry({
            status: 'DISCARDED',
            totalSeconds: 3600,
            note: 'Apontamento duplicado',
            canceladoPorNome: 'João Gestor',
          })}
          canEdit={false}
          onEdit={vi.fn()}
          canManage
          onRestore={onRestore}
        />,
      )
      expect(screen.getByText(/Apontamento duplicado/)).toBeInTheDocument()
      expect(screen.getByText(/João Gestor/)).toBeInTheDocument()
      await userEvent.click(screen.getByText('Restaurar'))
      expect(onRestore).toHaveBeenCalledTimes(1)
    })

    it('oculta "Restaurar" em DISCARDED quando canManage=false', () => {
      render(
        <TimeEntryCard
          entry={entry({ status: 'DISCARDED', totalSeconds: 3600 })}
          canEdit={false}
          onEdit={vi.fn()}
          onRestore={vi.fn()}
        />,
      )
      expect(screen.queryByText('Restaurar')).not.toBeInTheDocument()
    })

    it('bloco de motivo mostra "Descartado" (não "Cancelado") como cabeçalho', () => {
      render(
        <TimeEntryCard
          entry={entry({ status: 'DISCARDED', totalSeconds: 3600, note: 'Motivo X' })}
          canEdit={false}
          onEdit={vi.fn()}
          canManage
          onRestore={vi.fn()}
        />,
      )
      // "Descartado" aparece 2x: no badge de status e no cabeçalho do bloco de motivo
      // (nunca em "Cancelado" — diferencia do caso CANCELLED).
      expect(screen.getAllByText('Descartado').length).toBe(2)
      expect(screen.queryByText('Cancelado')).not.toBeInTheDocument()
    })

    it('observação (note) NÃO aparece como "Obs:" solto — vira motivo no bloco acima', () => {
      render(
        <TimeEntryCard
          entry={entry({ status: 'DISCARDED', totalSeconds: 3600, note: 'Motivo do descarte' })}
          canEdit={false}
          onEdit={vi.fn()}
        />,
      )
      expect(screen.queryByText('Obs:')).not.toBeInTheDocument()
      expect(screen.getByText(/Motivo do descarte/)).toBeInTheDocument()
    })
  })

  describe('Botão dinâmico Cancelar/Descartar (120, D-1 — decide por totalSeconds, não por status)', () => {
    it('COMPLETED com totalSeconds=0 → mostra "Cancelar apontamento"', () => {
      render(
        <TimeEntryCard
          entry={entry({ status: 'COMPLETED', totalSeconds: 0 })}
          canEdit={false}
          onEdit={vi.fn()}
          canManage
          onCancel={vi.fn()}
        />,
      )
      const button = screen.getByRole('button', { name: 'Cancelar apontamento' })
      expect(button).toBeInTheDocument()
      expect(button).toHaveAttribute('aria-label', 'Cancelar apontamento')
    })

    it('COMPLETED com totalSeconds > 0 → mostra "Descartar apontamento"', () => {
      render(
        <TimeEntryCard
          entry={entry({ status: 'COMPLETED', totalSeconds: 3600 })}
          canEdit={false}
          onEdit={vi.fn()}
          canManage
          onCancel={vi.fn()}
        />,
      )
      const button = screen.getByRole('button', { name: 'Descartar apontamento' })
      expect(button).toBeInTheDocument()
      expect(button).toHaveAttribute('aria-label', 'Descartar apontamento')
    })

    it('dispara onCancel ao clicar em "Descartar apontamento"', async () => {
      const onCancel = vi.fn()
      render(
        <TimeEntryCard
          entry={entry({ status: 'COMPLETED', totalSeconds: 3600 })}
          canEdit={false}
          onEdit={vi.fn()}
          canManage
          onCancel={onCancel}
        />,
      )
      await userEvent.click(screen.getByRole('button', { name: 'Descartar apontamento' }))
      expect(onCancel).toHaveBeenCalledTimes(1)
    })
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

  it.each([
    ['RUNNING', 'Em andamento'],
    ['PAUSED', 'Pausado'],
    ['COMPLETED', 'Concluído'],
    ['CANCELLED', 'Cancelado'],
    ['DISCARDED', 'Descartado'],
  ])('mostra o badge de status "%s" como "%s"', (status, label) => {
    render(<TimeEntryCard entry={entry({ status })} canEdit={false} onEdit={vi.fn()} />)
    // CANCELLED/DISCARDED também exibem o rótulo no bloco de motivo — basta ao menos uma ocorrência.
    expect(screen.getAllByText(label).length).toBeGreaterThanOrEqual(1)
  })

  it('mapeia o status independente de caixa (lowercase)', () => {
    render(<TimeEntryCard entry={entry({ status: 'running' })} canEdit={false} onEdit={vi.fn()} />)
    expect(screen.getByText('Em andamento')).toBeInTheDocument()
  })

  it('usa o valor bruto como fallback para status desconhecido', () => {
    render(<TimeEntryCard entry={entry({ status: 'ARCHIVED' })} canEdit={false} onEdit={vi.fn()} />)
    expect(screen.getByText('ARCHIVED')).toBeInTheDocument()
  })

  it('exibe o atendente quando informado', () => {
    render(<TimeEntryCard entry={entry({ agenteNome: 'Maria' })} canEdit={false} onEdit={vi.fn()} />)
    expect(screen.getByText('Maria')).toBeInTheDocument()
  })

  it('exibe fallback quando o atendente está vazio', () => {
    render(<TimeEntryCard entry={entry({ agenteNome: '' })} canEdit={false} onEdit={vi.fn()} />)
    expect(screen.getByText('Atendente não informado')).toBeInTheDocument()
  })
})
