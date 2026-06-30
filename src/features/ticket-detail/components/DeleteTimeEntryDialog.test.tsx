import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { DeleteTimeEntryDialog } from './DeleteTimeEntryDialog'

describe('DeleteTimeEntryDialog', () => {
  it('não renderiza quando fechado', () => {
    render(<DeleteTimeEntryDialog isOpen={false} onConfirm={vi.fn()} onClose={vi.fn()} />)
    expect(screen.queryByText('Excluir apontamento')).not.toBeInTheDocument()
  })

  it('exige motivo: erro inline e não chama onConfirm quando vazio', async () => {
    const onConfirm = vi.fn()
    render(<DeleteTimeEntryDialog isOpen onConfirm={onConfirm} onClose={vi.fn()} />)

    await userEvent.click(screen.getByRole('button', { name: /confirmar exclusão/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/motivo/i)
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('exige motivo: bloqueia quando muito curto', async () => {
    const onConfirm = vi.fn()
    render(<DeleteTimeEntryDialog isOpen onConfirm={onConfirm} onClose={vi.fn()} />)

    await userEvent.type(screen.getByLabelText(/motivo da exclusão/i), 'abc')
    await userEvent.click(screen.getByRole('button', { name: /confirmar exclusão/i }))

    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('confirma com o motivo (trim) quando válido', async () => {
    const onConfirm = vi.fn()
    render(<DeleteTimeEntryDialog isOpen onConfirm={onConfirm} onClose={vi.fn()} />)

    await userEvent.type(screen.getByLabelText(/motivo da exclusão/i), '  lançamento duplicado  ')
    await userEvent.click(screen.getByRole('button', { name: /confirmar exclusão/i }))

    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith('lançamento duplicado'))
  })

  it('dispara onClose ao cancelar', async () => {
    const onClose = vi.fn()
    render(<DeleteTimeEntryDialog isOpen onConfirm={vi.fn()} onClose={onClose} />)

    await userEvent.click(screen.getByRole('button', { name: /cancelar/i }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('desabilita os controles durante o submit', () => {
    render(<DeleteTimeEntryDialog isOpen isSubmitting onConfirm={vi.fn()} onClose={vi.fn()} />)

    expect(screen.getByLabelText(/motivo da exclusão/i)).toBeDisabled()
    expect(screen.getByRole('button', { name: /confirmar exclusão/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /cancelar/i })).toBeDisabled()
  })

  it('exibe erro de API quando fornecido', () => {
    render(
      <DeleteTimeEntryDialog
        isOpen
        apiError="Você não tem permissão para realizar esta ação."
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />,
    )
    expect(screen.getByText(/não tem permissão/i)).toBeInTheDocument()
  })
})
