import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider, useToast } from './Toast'

function ToastTrigger() {
  const toast = useToast()
  return (
    <div>
      <button onClick={() => toast.success('Salvo com sucesso.')}>disparar-success</button>
      <button onClick={() => toast.error('Falha ao salvar.')}>disparar-error</button>
      <button onClick={() => toast.info('Informação relevante.')}>disparar-info</button>
    </div>
  )
}

describe('Toast', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('exibe uma notificação de sucesso ao chamar toast.success', () => {
    render(
      <ToastProvider>
        <ToastTrigger />
      </ToastProvider>,
    )
    fireEvent.click(screen.getByText('disparar-success'))
    expect(screen.getByRole('alert')).toHaveTextContent('Salvo com sucesso.')
  })

  it('exibe uma notificação de erro ao chamar toast.error', () => {
    render(
      <ToastProvider>
        <ToastTrigger />
      </ToastProvider>,
    )
    fireEvent.click(screen.getByText('disparar-error'))
    expect(screen.getByRole('alert')).toHaveTextContent('Falha ao salvar.')
  })

  it('exibe uma notificação de info ao chamar toast.info', () => {
    render(
      <ToastProvider>
        <ToastTrigger />
      </ToastProvider>,
    )
    fireEvent.click(screen.getByText('disparar-info'))
    expect(screen.getByRole('alert')).toHaveTextContent('Informação relevante.')
  })

  it('empilha múltiplas notificações simultâneas', () => {
    render(
      <ToastProvider>
        <ToastTrigger />
      </ToastProvider>,
    )
    fireEvent.click(screen.getByText('disparar-success'))
    fireEvent.click(screen.getByText('disparar-error'))
    expect(screen.getAllByRole('alert')).toHaveLength(2)
  })

  it('fecha a notificação ao clicar no botão de fechar', () => {
    render(
      <ToastProvider>
        <ToastTrigger />
      </ToastProvider>,
    )
    fireEvent.click(screen.getByText('disparar-success'))
    expect(screen.getByRole('alert')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Fechar notificação' }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('remove a notificação automaticamente após 4s', () => {
    render(
      <ToastProvider>
        <ToastTrigger />
      </ToastProvider>,
    )
    fireEvent.click(screen.getByText('disparar-success'))
    expect(screen.getByRole('alert')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(4000)
    })

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('lança erro ao usar useToast fora do ToastProvider', () => {
    // Suprime o log de erro esperado do React para este teste
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<ToastTrigger />)).toThrow(
      'useToast deve ser usado dentro de <ToastProvider>',
    )
    consoleSpy.mockRestore()
  })
})
