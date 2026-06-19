import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { KpiCard } from './KpiCard'

// InfoIcon mock — evita dependência de CSS vars em teste unitário
vi.mock('../../../../components/ui/InfoIcon', () => ({
  InfoIcon: ({ tooltip }: { tooltip: string }) => (
    <span data-testid="info-icon" aria-label={tooltip} />
  ),
}))

describe('KpiCard', () => {
  it('exibe "—" quando value é null', () => {
    render(<KpiCard label="Backlog" value={null} />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('exibe "—" quando value é undefined', () => {
    render(<KpiCard label="CSAT" value={undefined} />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('exibe o valor formatado quando formatter é passado', () => {
    render(<KpiCard label="Taxa" value={0.75} formatter={(v) => `${(v * 100).toFixed(0)}%`} />)
    expect(screen.getByText('75%')).toBeInTheDocument()
  })

  it('exibe string diretamente quando value é string', () => {
    render(<KpiCard label="Equipe" value="Suporte Geral" />)
    expect(screen.getByText('Suporte Geral')).toBeInTheDocument()
  })

  it('exibe label corretamente', () => {
    render(<KpiCard label="Tickets abertos" value={42} />)
    expect(screen.getByText('Tickets abertos')).toBeInTheDocument()
  })

  it('isLoading: exibe skeleton com aria-busy e aria-label', () => {
    render(<KpiCard label="TMA" value={null} isLoading />)
    const skeleton = screen.getByLabelText('Carregando…')
    expect(skeleton).toHaveAttribute('aria-busy', 'true')
  })

  it('isLoading: não exibe valor numérico', () => {
    render(<KpiCard label="TMA" value={3600} isLoading />)
    expect(screen.queryByText('3600')).not.toBeInTheDocument()
    expect(screen.queryByText('—')).not.toBeInTheDocument()
  })

  it('onClick: define role="button" e tabIndex=0', () => {
    const onClick = vi.fn()
    render(<KpiCard label="Backlog" value={10} onClick={onClick} />)
    const card = screen.getByRole('button')
    expect(card).toBeInTheDocument()
    expect(card).toHaveAttribute('tabindex', '0')
  })

  it('sem onClick: não tem role="button"', () => {
    render(<KpiCard label="Backlog" value={10} />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('onClick: dispara ao clicar', () => {
    const onClick = vi.fn()
    render(<KpiCard label="Backlog" value={10} onClick={onClick} />)
    fireEvent.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('onClick: dispara ao pressionar Enter', () => {
    const onClick = vi.fn()
    render(<KpiCard label="Backlog" value={10} onClick={onClick} />)
    const card = screen.getByRole('button')
    fireEvent.keyDown(card, { key: 'Enter' })
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('onClick: não dispara ao pressionar Space (somente Enter)', () => {
    const onClick = vi.fn()
    render(<KpiCard label="Backlog" value={10} onClick={onClick} />)
    const card = screen.getByRole('button')
    fireEvent.keyDown(card, { key: ' ' })
    expect(onClick).not.toHaveBeenCalled()
  })

  it('subtextVariant positive: aplica classe text-success-fg', () => {
    render(
      <KpiCard label="Taxa" value={90} subtext="+5% vs mês anterior" subtextVariant="positive" />,
    )
    const subtext = screen.getByText('+5% vs mês anterior')
    expect(subtext.className).toContain('text-success-fg')
  })

  it('subtextVariant negative: aplica classe text-error-fg', () => {
    render(
      <KpiCard label="Taxa" value={50} subtext="-10% vs mês anterior" subtextVariant="negative" />,
    )
    const subtext = screen.getByText('-10% vs mês anterior')
    expect(subtext.className).toContain('text-error-fg')
  })

  it('subtextVariant neutral (default): aplica classe text-muted', () => {
    render(<KpiCard label="Taxa" value={70} subtext="Sem variação" />)
    const subtext = screen.getByText('Sem variação')
    expect(subtext.className).toContain('text-muted')
  })

  it('sem subtext: não renderiza elemento de subtext', () => {
    render(<KpiCard label="Backlog" value={5} />)
    // aria-describedby não deve existir sem subtext
    expect(screen.queryByRole('paragraph')).not.toBeInTheDocument()
  })

  it('tooltipText: exibe InfoIcon com tooltip', () => {
    render(<KpiCard label="FCR" value={80} tooltipText="Primeiro contato" />)
    const icon = screen.getByTestId('info-icon')
    expect(icon).toBeInTheDocument()
    expect(icon).toHaveAttribute('aria-label', 'Primeiro contato')
  })

  it('sem tooltipText: não exibe InfoIcon', () => {
    render(<KpiCard label="Backlog" value={10} />)
    expect(screen.queryByTestId('info-icon')).not.toBeInTheDocument()
  })
})
