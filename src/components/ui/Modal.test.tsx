/**
 * Testes do Modal — foco nas adições da 096:
 * tamanho 'fullscreen' (92vw × 92vh, 4% de margem) e backdrop com blur opt-in.
 */

import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Modal } from './Modal'

describe('Modal', () => {
  it('aplica dimensões 92vw × 92vh no tamanho fullscreen', () => {
    render(
      <Modal isOpen onClose={vi.fn()} title="Preview" size="fullscreen">
        <div>conteúdo</div>
      </Modal>,
    )
    const dialog = screen.getByRole('dialog')
    const content = dialog.querySelector('.bg-card') as HTMLElement
    expect(content.className).toContain('w-[92vw]')
    expect(content.className).toContain('h-[92vh]')
    expect(content.className).toContain('max-w-[92vw]')
    expect(content.className).toContain('max-h-[92vh]')
  })

  it('usa backdrop-blur-sm por padrão', () => {
    render(
      <Modal isOpen onClose={vi.fn()} title="X">
        <div>c</div>
      </Modal>,
    )
    const overlay = screen.getByRole('dialog').querySelector('[aria-hidden="true"]') as HTMLElement
    expect(overlay.className).toContain('backdrop-blur-sm')
  })

  it('usa backdrop-blur-md quando backdropBlur="lg" (opt-in)', () => {
    render(
      <Modal isOpen onClose={vi.fn()} title="X" backdropBlur="lg">
        <div>c</div>
      </Modal>,
    )
    const overlay = screen.getByRole('dialog').querySelector('[aria-hidden="true"]') as HTMLElement
    expect(overlay.className).toContain('backdrop-blur-md')
  })

  it('não renderiza quando isOpen=false', () => {
    render(
      <Modal isOpen={false} onClose={vi.fn()} title="X">
        <div>c</div>
      </Modal>,
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
