import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Badge } from './Badge'
import { contrastRatio } from '../../utils/colorContrast'

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

  it('aplica as classes do token novo "Descartado" (120, D-1 — 100% aditivo)', () => {
    render(<Badge value="Descartado" />)
    const badge = screen.getByText('Descartado')
    expect(badge.className).toContain('bg-status-descartado-bg')
    expect(badge.className).toContain('text-status-descartado-fg')
  })

  it('não altera nenhuma entrada existente do BADGE_MAP (Pausado/Cancelado, débito AP-FRONTEND-018)', () => {
    render(
      <>
        <Badge value="Pausado" />
        <Badge value="Cancelado" />
      </>,
    )
    expect(screen.getByText('Pausado').className).toContain('bg-warning-bg')
    expect(screen.getByText('Pausado').className).toContain('text-warning-fg')
    expect(screen.getByText('Cancelado').className).toContain('bg-error-bg')
    expect(screen.getByText('Cancelado').className).toContain('text-error-fg')
  })
})

describe('Badge — contraste do par novo "Descartado" (120, D-1)', () => {
  it('par "Descartado" atinge contraste >= 4.5:1 (AA, texto pequeno) — escopado só à entrada nova', () => {
    // NÃO retrofita 'Pausado'/'Cancelado' — débito conhecido, fora desta unidade (AP-FRONTEND-018).
    expect(contrastRatio('#6b21a8', '#f3e8ff')).toBeGreaterThanOrEqual(4.5)
  })
})
