import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SyncStatusBadge } from './SyncStatusBadge'

describe('SyncStatusBadge', () => {
  it('exibe "Online" quando statusSistema=online', () => {
    render(<SyncStatusBadge statusSistema="online" />)
    expect(screen.getByText('Online')).toBeInTheDocument()
  })

  it('exibe "Degradado" quando statusSistema=degradado', () => {
    render(<SyncStatusBadge statusSistema="degradado" />)
    expect(screen.getByText('Degradado')).toBeInTheDocument()
  })

  it('exibe "Offline" quando statusSistema=offline', () => {
    render(<SyncStatusBadge statusSistema="offline" />)
    expect(screen.getByText('Offline')).toBeInTheDocument()
  })

  it('tem aria-live="polite" no elemento com aria-label', () => {
    render(<SyncStatusBadge statusSistema="online" />)
    const badge = screen.getByLabelText(/Status do sincronizador: Online/)
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveAttribute('aria-live', 'polite')
  })

  it('aria-label descreve o estado corretamente para Offline', () => {
    render(<SyncStatusBadge statusSistema="offline" />)
    expect(screen.getByLabelText(/Status do sincronizador: Offline/)).toBeInTheDocument()
  })

  it('aria-label descreve o estado corretamente para Degradado', () => {
    render(<SyncStatusBadge statusSistema="degradado" />)
    expect(screen.getByLabelText(/Status do sincronizador: Degradado/)).toBeInTheDocument()
  })
})
