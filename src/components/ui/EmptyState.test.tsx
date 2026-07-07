import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { EmptyState } from './EmptyState'

describe('EmptyState', () => {
  it('renderiza a mensagem', () => {
    render(<EmptyState message="Nenhum item encontrado." />)
    expect(screen.getByText('Nenhum item encontrado.')).toBeInTheDocument()
  })

  it('não renderiza botão de ação quando `action` não é passado', () => {
    render(<EmptyState message="Vazio." />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('renderiza o botão de ação e chama onClick ao clicar', () => {
    const onClick = vi.fn()
    render(<EmptyState message="Vazio." action={{ label: 'Adicionar', onClick }} />)
    const button = screen.getByRole('button', { name: 'Adicionar' })
    fireEvent.click(button)
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})
