import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CreditoStatusBadge } from './CreditoStatusBadge'

describe('CreditoStatusBadge', () => {
  it('traduz os três status conhecidos e marca o valor normalizado no DOM', () => {
    const { container } = render(
      <>
        <CreditoStatusBadge status="vigente" />
        <CreditoStatusBadge status="expirado" />
        <CreditoStatusBadge status="estornado" />
      </>,
    )
    expect(screen.getByText('Vigente')).toBeInTheDocument()
    expect(screen.getByText('Expirado')).toBeInTheDocument()
    expect(screen.getByText('Estornado')).toBeInTheDocument()
    expect(
      [...container.querySelectorAll('[data-status]')].map((n) => n.getAttribute('data-status')),
    ).toEqual(['vigente', 'expirado', 'estornado'])
  })

  it('🔴 status desconhecido aparece CRU, em neutro — nunca vestido de um conhecido', () => {
    // Vermelho se o normalizador virar fail-open: um `'mosaico'` pintado de verde
    // afirmaria "vigente" sobre um estado que este painel não conhece (`AP-API-002`).
    const { container } = render(<CreditoStatusBadge status="mosaico" />)
    const pilula = screen.getByText('mosaico')
    expect(pilula.getAttribute('data-status')).toBe('desconhecido')
    expect(pilula.className).toContain('bg-badge-neutro-bg')
    expect(container.textContent).not.toContain('Vigente')
  })

  it('`null` não vira pílula nenhuma — só o traço', () => {
    const { container } = render(<CreditoStatusBadge status={null} />)
    expect(container.querySelector('[data-status]')).toBeNull()
    expect(container.textContent).toBe('—')
  })

  it('WCAG 1.4.1: a informação está no TEXTO — remover a cor não apaga o significado', () => {
    const { container } = render(<CreditoStatusBadge status="estornado" />)
    const pilula = container.querySelector('[data-status]') as HTMLElement
    pilula.className = ''
    expect(pilula.textContent).toBe('Estornado')
  })
})
