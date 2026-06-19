import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SyncStatusBadge } from './SyncStatusBadge'

describe('SyncStatusBadge', () => {
  it('exibe "Online" quando isOnline=true e lastStatus=concluido', () => {
    render(<SyncStatusBadge isOnline={true} lastStatus="concluido" />)
    expect(screen.getByText('Online')).toBeInTheDocument()
  })

  it('exibe "Online" quando isOnline=true e lastStatus=null', () => {
    render(<SyncStatusBadge isOnline={true} lastStatus={null} />)
    expect(screen.getByText('Online')).toBeInTheDocument()
  })

  it('exibe "Degradado" quando isOnline=true e lastStatus=erro', () => {
    render(<SyncStatusBadge isOnline={true} lastStatus="erro" />)
    expect(screen.getByText('Degradado')).toBeInTheDocument()
  })

  it('exibe "Offline" quando isOnline=false', () => {
    render(<SyncStatusBadge isOnline={false} lastStatus={null} />)
    expect(screen.getByText('Offline')).toBeInTheDocument()
  })

  it('exibe "Offline" quando isOnline=false mesmo com lastStatus=concluido', () => {
    render(<SyncStatusBadge isOnline={false} lastStatus="concluido" />)
    expect(screen.getByText('Offline')).toBeInTheDocument()
  })

  it('tem aria-live="polite" no elemento com aria-label', () => {
    render(<SyncStatusBadge isOnline={true} lastStatus="concluido" />)
    // Verificar via aria-label que inclui o status
    const badge = screen.getByLabelText(/Status do sincronizador: Online/)
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveAttribute('aria-live', 'polite')
  })

  it('aria-label descreve o estado corretamente para Offline', () => {
    render(<SyncStatusBadge isOnline={false} lastStatus={null} />)
    expect(screen.getByLabelText(/Status do sincronizador: Offline/)).toBeInTheDocument()
  })

  it('aria-label descreve o estado corretamente para Degradado', () => {
    render(<SyncStatusBadge isOnline={true} lastStatus="erro" />)
    expect(screen.getByLabelText(/Status do sincronizador: Degradado/)).toBeInTheDocument()
  })
})
