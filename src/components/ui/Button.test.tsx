import { createRef } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Button } from './Button'

describe('Button', () => {
  it('renderiza os filhos e chama onClick ao clicar', () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Salvar</Button>)
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('não chama onClick quando desabilitado', () => {
    const onClick = vi.fn()
    render(
      <Button onClick={onClick} disabled>
        Salvar
      </Button>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    expect(onClick).not.toHaveBeenCalled()
  })

  it('desabilita o botão quando isLoading e marca aria-busy', () => {
    render(<Button isLoading>Salvar</Button>)
    const button = screen.getByRole('button')
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')
  })

  it('não chama onClick quando isLoading (DS ignora o clique em loading)', () => {
    const onClick = vi.fn()
    render(
      <Button onClick={onClick} isLoading>
        Salvar
      </Button>,
    )
    fireEvent.click(screen.getByRole('button'))
    expect(onClick).not.toHaveBeenCalled()
  })

  it('usa type="button" por padrão', () => {
    render(<Button>Salvar</Button>)
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button')
  })

  it('repassa type="submit"', () => {
    render(<Button type="submit">Enviar</Button>)
    expect(screen.getByRole('button')).toHaveAttribute('type', 'submit')
  })

  it('renderiza o ícone informado', () => {
    render(<Button icon={<svg data-testid="icone" />}>Ação</Button>)
    expect(screen.getByTestId('icone')).toBeInTheDocument()
  })

  it('aplica aria-label quando informado', () => {
    render(<Button aria-label="Fechar" icon={<svg />} />)
    expect(screen.getByRole('button', { name: 'Fechar' })).toBeInTheDocument()
  })

  it('variant="ghost" não quebra e preserva o clique', () => {
    const onClick = vi.fn()
    render(
      <Button variant="ghost" onClick={onClick}>
        Sair
      </Button>,
    )
    const button = screen.getByRole('button', { name: 'Sair' })
    expect(button.className).toContain('bg-transparent')
    fireEvent.click(button)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('variant="danger" aplica o fundo do token de erro (bg-error)', () => {
    render(<Button variant="danger">Excluir</Button>)
    expect(screen.getByRole('button', { name: 'Excluir' }).className).toContain('bg-error')
  })

  it('className externo é preservado ao lado das classes do variant', () => {
    render(<Button className="w-35">Salvar</Button>)
    expect(screen.getByRole('button').className).toContain('w-35')
  })

  it('encaminha ref para o elemento <button> (uso em foco programático)', () => {
    const ref = createRef<HTMLButtonElement>()
    render(<Button ref={ref}>Salvar</Button>)
    expect(ref.current).toBeInstanceOf(HTMLButtonElement)
  })
})
