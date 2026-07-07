import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Badge } from './Badge'

describe('Badge', () => {
  it('renderiza o valor como texto', () => {
    render(<Badge value="Faturado" />)
    expect(screen.getByText('Faturado')).toBeInTheDocument()
  })

  it('aplica as classes do mapa conhecido para um valor catalogado', () => {
    render(<Badge value="Faturado" />)
    const badge = screen.getByText('Faturado')
    expect(badge.className).toContain('bg-badge-faturado-bg')
    expect(badge.className).toContain('text-badge-faturado-fg')
  })

  it('usa o fallback neutro para um valor desconhecido (nunca quebra)', () => {
    render(<Badge value="Categoria Nova Nunca Vista" />)
    const badge = screen.getByText('Categoria Nova Nunca Vista')
    expect(badge.className).toContain('bg-badge-neutro-bg')
    expect(badge.className).toContain('text-badge-neutro-fg')
  })

  it('aplica truncate e title quando truncate=true', () => {
    render(<Badge value="Plano de Suporte" truncate />)
    const badge = screen.getByText('Plano de Suporte')
    expect(badge.className).toContain('truncate')
    expect(badge).toHaveAttribute('title', 'Plano de Suporte')
  })

  it('não aplica title quando truncate=false', () => {
    render(<Badge value="Plano de Suporte" />)
    expect(screen.getByText('Plano de Suporte')).not.toHaveAttribute('title')
  })

  it('repassa style inline (exceção documentada, ex.: tomato)', () => {
    render(<Badge value="Categoria X" style={{ backgroundColor: 'tomato' }} />)
    const badge = screen.getByText('Categoria X')
    expect(badge.style.backgroundColor).toBe('tomato')
  })
})
