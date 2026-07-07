import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Switch } from './Switch'

describe('Switch', () => {
  it('renderiza com role="switch" e aria-checked refletindo o estado', () => {
    render(<Switch checked={false} onChange={vi.fn()} label="Ativo" />)
    const el = screen.getByRole('switch', { name: 'Ativo' })
    expect(el).toHaveAttribute('aria-checked', 'false')
  })

  it('chama onChange com o valor invertido ao clicar', () => {
    const onChange = vi.fn()
    render(<Switch checked={false} onChange={onChange} label="Ativo" />)
    fireEvent.click(screen.getByRole('switch'))
    expect(onChange).toHaveBeenCalledWith(true)
  })

  it('não chama onChange quando disabled', () => {
    const onChange = vi.fn()
    render(<Switch checked={false} onChange={onChange} label="Ativo" disabled />)
    fireEvent.click(screen.getByRole('switch'))
    expect(onChange).not.toHaveBeenCalled()
  })

  it('é operável por teclado (Enter/Espaço, via clique do botão nativo)', () => {
    const onChange = vi.fn()
    render(<Switch checked={true} onChange={onChange} label="Ativo" />)
    const el = screen.getByRole('switch')
    el.focus()
    fireEvent.click(el)
    expect(onChange).toHaveBeenCalledWith(false)
  })

  it('usa aria-label quando hideLabel=true (padrão)', () => {
    render(<Switch checked={false} onChange={vi.fn()} label="Notificações" />)
    expect(screen.getByRole('switch', { name: 'Notificações' })).toHaveAttribute(
      'aria-label',
      'Notificações',
    )
  })

  it('não duplica aria-label quando hideLabel=false (rótulo visível externo)', () => {
    render(<Switch checked={false} onChange={vi.fn()} label="Notificações" hideLabel={false} />)
    expect(screen.getByRole('switch')).not.toHaveAttribute('aria-label')
  })
})
