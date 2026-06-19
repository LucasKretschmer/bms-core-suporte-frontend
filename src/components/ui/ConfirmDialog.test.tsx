import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ConfirmDialog } from './ConfirmDialog'

const defaultProps = {
  isOpen: true,
  onClose: vi.fn(),
  onConfirm: vi.fn(),
  title: 'Título de teste',
  description: 'Descrição de teste',
}

describe('ConfirmDialog', () => {
  it('não renderiza quando isOpen=false', () => {
    render(<ConfirmDialog {...defaultProps} isOpen={false} />)
    expect(screen.queryByText('Título de teste')).not.toBeInTheDocument()
  })

  it('renderiza título e descrição quando isOpen=true', () => {
    render(<ConfirmDialog {...defaultProps} />)
    expect(screen.getByText('Título de teste')).toBeInTheDocument()
    expect(screen.getByText('Descrição de teste')).toBeInTheDocument()
  })

  it('chama onConfirm ao clicar no botão de confirmação', () => {
    const onConfirm = vi.fn()
    render(<ConfirmDialog {...defaultProps} onConfirm={onConfirm} confirmLabel="Confirmar" />)
    fireEvent.click(screen.getByText('Confirmar'))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('chama onClose ao clicar em cancelar', () => {
    const onClose = vi.fn()
    render(<ConfirmDialog {...defaultProps} onClose={onClose} cancelLabel="Cancelar" />)
    fireEvent.click(screen.getByText('Cancelar'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('chama onClose ao pressionar Escape', () => {
    const onClose = vi.fn()
    render(<ConfirmDialog {...defaultProps} onClose={onClose} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('isLoading=true desabilita o botão de confirmação', () => {
    render(<ConfirmDialog {...defaultProps} isLoading={true} confirmLabel="Confirmar" />)
    const confirmBtn = screen.getByText('Confirmar').closest('button')
    expect(confirmBtn).toBeDisabled()
  })

  it('isLoading=true desabilita o botão de cancelar', () => {
    render(<ConfirmDialog {...defaultProps} isLoading={true} cancelLabel="Cancelar" />)
    const cancelBtn = screen.getByText('Cancelar').closest('button')
    expect(cancelBtn).toBeDisabled()
  })

  it('usa rótulos customizados quando fornecidos', () => {
    render(
      <ConfirmDialog
        {...defaultProps}
        confirmLabel="Sim, deletar"
        cancelLabel="Não, voltar"
      />,
    )
    expect(screen.getByText('Sim, deletar')).toBeInTheDocument()
    expect(screen.getByText('Não, voltar')).toBeInTheDocument()
  })

  it('usa rótulos padrão quando não fornecidos', () => {
    render(<ConfirmDialog {...defaultProps} />)
    expect(screen.getByText('Confirmar')).toBeInTheDocument()
    expect(screen.getByText('Cancelar')).toBeInTheDocument()
  })

  it('variant=danger usa role=alertdialog', () => {
    render(<ConfirmDialog {...defaultProps} variant="danger" />)
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
  })

  it('variant=default usa role=dialog', () => {
    render(<ConfirmDialog {...defaultProps} variant="default" />)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})
