import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { CancelTimeEntryDialog } from './CancelTimeEntryDialog'

describe('CancelTimeEntryDialog', () => {
  it('não renderiza quando fechado', () => {
    render(<CancelTimeEntryDialog isOpen={false} onConfirm={vi.fn()} onClose={vi.fn()} />)
    expect(screen.queryByText('Cancelar apontamento')).not.toBeInTheDocument()
  })

  it('exige motivo: erro inline e não chama onConfirm quando vazio', async () => {
    const onConfirm = vi.fn()
    render(<CancelTimeEntryDialog isOpen onConfirm={onConfirm} onClose={vi.fn()} />)

    await userEvent.click(screen.getByRole('button', { name: /confirmar cancelamento/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/motivo/i)
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('bloqueia quando o motivo tem menos de 10 caracteres', async () => {
    const onConfirm = vi.fn()
    render(<CancelTimeEntryDialog isOpen onConfirm={onConfirm} onClose={vi.fn()} />)

    await userEvent.type(screen.getByLabelText(/motivo do cancelamento/i), 'curto')
    await userEvent.click(screen.getByRole('button', { name: /confirmar cancelamento/i }))

    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('confirma com o motivo (trim) quando válido (>= 10 chars)', async () => {
    const onConfirm = vi.fn()
    render(<CancelTimeEntryDialog isOpen onConfirm={onConfirm} onClose={vi.fn()} />)

    await userEvent.type(
      screen.getByLabelText(/motivo do cancelamento/i),
      '  lançamento duplicado  ',
    )
    await userEvent.click(screen.getByRole('button', { name: /confirmar cancelamento/i }))

    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith('lançamento duplicado'))
  })

  it('dispara onClose ao voltar', async () => {
    const onClose = vi.fn()
    render(<CancelTimeEntryDialog isOpen onConfirm={vi.fn()} onClose={onClose} />)

    await userEvent.click(screen.getByRole('button', { name: /voltar/i }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('desabilita os controles durante o submit', () => {
    render(<CancelTimeEntryDialog isOpen isSubmitting onConfirm={vi.fn()} onClose={vi.fn()} />)

    expect(screen.getByLabelText(/motivo do cancelamento/i)).toBeDisabled()
    expect(screen.getByRole('button', { name: /confirmar cancelamento/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /voltar/i })).toBeDisabled()
  })

  it('exibe erro de API quando fornecido', () => {
    render(
      <CancelTimeEntryDialog
        isOpen
        apiError="Você não tem permissão para realizar esta ação."
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />,
    )
    expect(screen.getByText(/não tem permissão/i)).toBeInTheDocument()
  })
})
