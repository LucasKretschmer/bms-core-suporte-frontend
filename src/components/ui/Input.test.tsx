import { createRef } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { Input } from './Input'

describe('Input', () => {
  it('associa o label ao campo via htmlFor/id', () => {
    render(<Input label="Nome" />)
    const input = screen.getByLabelText('Nome')
    expect(input).toBeInstanceOf(HTMLInputElement)
  })

  it('gera ids distintos (useId) quando duas instâncias têm o mesmo label (AP-FRONTEND-003)', () => {
    render(
      <>
        <Input label="Nome" />
        <Input label="Nome" />
      </>,
    )
    const inputs = screen.getAllByLabelText('Nome')
    expect(inputs).toHaveLength(2)
    expect(inputs[0].id).not.toBe(inputs[1].id)
  })

  it('exibe a mensagem de erro e marca aria-invalid/aria-describedby', () => {
    render(<Input label="E-mail" error="O e-mail é obrigatório." />)
    const input = screen.getByLabelText('E-mail')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    const error = screen.getByText('O e-mail é obrigatório.')
    expect(input.getAttribute('aria-describedby')).toBe(error.id)
  })

  it('exibe o hint quando não há erro', () => {
    render(<Input label="Senha" hint="Mínimo de 8 caracteres." />)
    expect(screen.getByText('Mínimo de 8 caracteres.')).toBeInTheDocument()
  })

  it('exibe o asterisco quando required', () => {
    render(<Input label="Nome" required />)
    expect(screen.getByText('*')).toBeInTheDocument()
  })

  it('encaminha ref para o elemento <input> (compatível com RHF register)', () => {
    const ref = createRef<HTMLInputElement>()
    render(<Input label="Nome" ref={ref} />)
    expect(ref.current).toBeInstanceOf(HTMLInputElement)
  })

  it('aceita digitação e dispara onChange', async () => {
    const user = userEvent.setup()
    render(<Input label="Nome" />)
    const input = screen.getByLabelText('Nome')
    await user.type(input, 'Ana')
    expect(input).toHaveValue('Ana')
  })

  it('respeita disabled', () => {
    render(<Input label="Nome" disabled />)
    expect(screen.getByLabelText('Nome')).toBeDisabled()
  })
})
