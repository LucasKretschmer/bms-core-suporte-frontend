import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ErrorState } from './ErrorState'

describe('ErrorState', () => {
  it('usa a mensagem padrão do app quando `message` não é passada', () => {
    render(<ErrorState />)
    expect(screen.getByText('Ocorreu um erro ao carregar os dados.')).toBeInTheDocument()
  })

  it('renderiza mensagem customizada quando passada', () => {
    render(<ErrorState message="Falha ao buscar tickets." />)
    expect(screen.getByText('Falha ao buscar tickets.')).toBeInTheDocument()
  })

  it('não renderiza botão de retry quando onRetry não é passado', () => {
    render(<ErrorState />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('renderiza botão de retry e chama onRetry ao clicar', () => {
    const onRetry = vi.fn()
    render(<ErrorState onRetry={onRetry} />)
    fireEvent.click(screen.getByRole('button', { name: /tentar novamente/i }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('expõe role="alert" para leitores de tela', () => {
    render(<ErrorState />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })
})
