import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { InfoIcon } from './InfoIcon'

const TIP = 'Horas consumidas além do plano contratado.'

describe('InfoIcon', () => {
  it('não exibe o balão inicialmente', () => {
    render(<InfoIcon tooltip={TIP} />)
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  it('exibe o balão no hover (mouseenter) e some no mouseleave', () => {
    render(<InfoIcon tooltip={TIP} />)
    const button = screen.getByRole('button', { name: TIP })

    fireEvent.mouseEnter(button)
    expect(screen.getByRole('tooltip')).toHaveTextContent(TIP)

    fireEvent.mouseLeave(button)
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  it('exibe o balão no foco por teclado e some no blur', () => {
    render(<InfoIcon tooltip={TIP} />)
    const button = screen.getByRole('button', { name: TIP })

    fireEvent.focus(button)
    expect(screen.getByRole('tooltip')).toBeInTheDocument()

    fireEvent.blur(button)
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  it('renderiza o balão via portal em document.body (fora da célula)', () => {
    const { container } = render(<InfoIcon tooltip={TIP} />)
    const button = screen.getByRole('button', { name: TIP })

    fireEvent.mouseEnter(button)
    const tooltip = screen.getByRole('tooltip')
    // O balão vive no body, não dentro do container do componente.
    expect(container.contains(tooltip)).toBe(false)
    expect(document.body.contains(tooltip)).toBe(true)
  })

  it('associa aria-describedby ao botão apenas quando visível', () => {
    render(<InfoIcon tooltip={TIP} />)
    const button = screen.getByRole('button', { name: TIP })
    expect(button).not.toHaveAttribute('aria-describedby')

    fireEvent.focus(button)
    const tooltip = screen.getByRole('tooltip')
    expect(button.getAttribute('aria-describedby')).toBe(tooltip.id)

    fireEvent.blur(button)
    expect(button).not.toHaveAttribute('aria-describedby')
  })

  it('usa position fixed e z-index de tooltip acima de modais (z-60)', () => {
    render(<InfoIcon tooltip={TIP} />)
    fireEvent.mouseEnter(screen.getByRole('button', { name: TIP }))
    const tooltip = screen.getByRole('tooltip')
    expect(tooltip.className).toContain('fixed')
    expect(tooltip.className).toContain('z-[60]')
  })

  it('mantém aria-label acessível no botão', () => {
    render(<InfoIcon tooltip={TIP} />)
    expect(screen.getByRole('button', { name: TIP })).toBeInTheDocument()
  })
})
