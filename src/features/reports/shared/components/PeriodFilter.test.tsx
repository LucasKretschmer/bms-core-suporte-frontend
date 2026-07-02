import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PeriodFilter } from './PeriodFilter'

describe('PeriodFilter', () => {
  it('exibe erro inline quando from > to', () => {
    render(<PeriodFilter from="2026-06-30" to="2026-06-01" onChange={vi.fn()} />)
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('A data inicial não pode ser maior que a data final.')
  })

  it('não exibe erro no caminho feliz (from <= to)', () => {
    render(<PeriodFilter from="2026-06-01" to="2026-06-30" onChange={vi.fn()} />)
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('não exibe erro quando um extremo é nulo (intervalo aberto)', () => {
    render(<PeriodFilter from={null} to="2026-06-30" onChange={vi.fn()} />)
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('detecta from > to em mode="month"', () => {
    render(<PeriodFilter from="2026-07" to="2026-06" onChange={vi.fn()} mode="month" />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('normaliza data com dia impossível no commit (blur) e propaga o valor corrigido', () => {
    // O input nativo type="date" sanitiza dia impossível no browser/jsdom, então
    // o commit lê o value do próprio input. Para exercitar o clamp de forma
    // determinística, disparamos o blur com um target cujo value é a data inválida
    // (simulando o cenário-limite em que uma string inválida chega ao campo).
    const onChange = vi.fn()
    render(
      <PeriodFilter from={null} to="2026-06-15" onChange={onChange} labelFrom="De" labelTo="Até" />,
    )
    const fromInput = screen.getByLabelText('De') as HTMLInputElement
    // Força o value inválido no elemento e dispara o blur — replica o caso em que
    // o campo carregou uma string de dia impossível (ex.: valor injetado/legado).
    Object.defineProperty(fromInput, 'value', { configurable: true, value: '2026-06-31' })
    fireEvent.blur(fromInput)
    // A última chamada deve propagar a data clampada (30/06), preservando o `to`.
    expect(onChange).toHaveBeenLastCalledWith('2026-06-30', '2026-06-15')
  })

  it('não altera valor já válido no commit (blur)', () => {
    const onChange = vi.fn()
    render(<PeriodFilter from="2026-06-10" to="2026-06-20" onChange={onChange} labelFrom="De" labelTo="Até" />)
    const fromInput = screen.getByLabelText('De')
    fireEvent.blur(fromInput, { target: { value: '2026-06-10' } })
    // Sem mudança de valor → não propaga no blur.
    expect(onChange).not.toHaveBeenCalled()
  })

  it('mantém retrocompat: funciona sem props além de from/to/onChange', () => {
    const onChange = vi.fn()
    render(<PeriodFilter from={null} to={null} onChange={onChange} />)
    // Labels default de mode="date".
    expect(screen.getByLabelText('De')).toBeInTheDocument()
    expect(screen.getByLabelText('Até')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('De'), { target: { value: '2026-06-01' } })
    expect(onChange).toHaveBeenCalledWith('2026-06-01', null)
  })
})
