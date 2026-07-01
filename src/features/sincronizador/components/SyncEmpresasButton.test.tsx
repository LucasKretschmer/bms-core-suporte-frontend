import { render, screen, fireEvent } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// ── Mock do hook: controla estado da mutation por teste ───────────────────────

const { mockMutate, mockUseSyncEmpresas } = vi.hoisted(() => ({
  mockMutate: vi.fn(),
  mockUseSyncEmpresas: vi.fn(),
}))

vi.mock('../hooks/useSyncEmpresas', () => ({
  useSyncEmpresas: mockUseSyncEmpresas,
}))

import { SyncEmpresasButton } from './SyncEmpresasButton'

describe('SyncEmpresasButton', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseSyncEmpresas.mockReturnValue({ mutate: mockMutate, isPending: false })
  })

  it('renderiza com label acessível', () => {
    render(<SyncEmpresasButton />)
    expect(
      screen.getByRole('button', { name: 'Sincronizar empresas com HubSpot' }),
    ).toBeInTheDocument()
  })

  it('dispara a mutation (endpoint) ao clicar', () => {
    render(<SyncEmpresasButton />)
    fireEvent.click(screen.getByRole('button'))
    expect(mockMutate).toHaveBeenCalledTimes(1)
  })

  it('desabilita o botão durante o loading e marca aria-busy', () => {
    mockUseSyncEmpresas.mockReturnValue({ mutate: mockMutate, isPending: true })
    render(<SyncEmpresasButton />)

    const button = screen.getByRole('button')
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')
  })

  it('não dispara a mutation quando desabilitado (loading)', () => {
    mockUseSyncEmpresas.mockReturnValue({ mutate: mockMutate, isPending: true })
    render(<SyncEmpresasButton />)

    fireEvent.click(screen.getByRole('button'))
    expect(mockMutate).not.toHaveBeenCalled()
  })
})
