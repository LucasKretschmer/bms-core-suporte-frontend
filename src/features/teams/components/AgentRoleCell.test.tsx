import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockMutate } = vi.hoisted(() => ({ mockMutate: vi.fn() }))

let mockIsPending = false

vi.mock('../hooks/useUpdateAgentRole', () => ({
  useUpdateAgentRole: () => ({
    mutate: mockMutate,
    isPending: mockIsPending,
  }),
}))

import { AgentRoleCell } from './AgentRoleCell'
import type { AgentDto } from '../types/team'

function makeAgent(overrides?: Partial<AgentDto>): AgentDto {
  return {
    userId: 1,
    nome: 'Ana',
    email: 'ana@migrate.info',
    equipeId: 5,
    equipeNome: 'Suporte',
    papel: 'ATENDENTE',
    ...overrides,
  }
}

describe('AgentRoleCell (#13)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsPending = false
  })

  it('mostra o perfil atual derivado da role (ATENDENTE → "Atendente")', () => {
    render(<AgentRoleCell agent={makeAgent({ papel: 'ATENDENTE' })} canEdit isSelf={false} />)
    expect(screen.getByRole('combobox')).toHaveTextContent('Atendente')
  })

  it('mostra "Gestor" quando a role é GERENTE', () => {
    render(<AgentRoleCell agent={makeAgent({ papel: 'GERENTE' })} canEdit isSelf={false} />)
    expect(screen.getByRole('combobox')).toHaveTextContent('Gestor')
  })

  it('ao trocar para "gestor" dispara a mutation com o perfil mapeado', () => {
    render(
      <AgentRoleCell agent={makeAgent({ userId: 7, papel: 'ATENDENTE' })} canEdit isSelf={false} />,
    )

    fireEvent.click(screen.getByRole('combobox'))
    fireEvent.click(screen.getByRole('option', { name: 'Gestor' }))

    expect(mockMutate).toHaveBeenCalledWith({ userId: 7, profile: 'gestor' })
  })

  it('não dispara mutation ao "trocar" para o mesmo perfil atual', () => {
    render(<AgentRoleCell agent={makeAgent({ papel: 'ATENDENTE' })} canEdit isSelf={false} />)

    fireEvent.click(screen.getByRole('combobox'))
    fireEvent.click(screen.getByRole('option', { name: 'Atendente' }))

    expect(mockMutate).not.toHaveBeenCalled()
  })

  it('combobox desabilitado quando sem permissão de edição', () => {
    render(<AgentRoleCell agent={makeAgent()} canEdit={false} isSelf={false} />)
    expect(screen.getByRole('combobox')).toBeDisabled()
  })

  it('combobox desabilitado durante o submit (isPending)', () => {
    mockIsPending = true
    render(<AgentRoleCell agent={makeAgent()} canEdit isSelf={false} />)
    expect(screen.getByRole('combobox')).toBeDisabled()
  })

  it('exibe aviso de re-login quando é o próprio usuário', () => {
    render(<AgentRoleCell agent={makeAgent()} canEdit isSelf />)
    expect(screen.getByText(/só vale após novo login/i)).toBeInTheDocument()
  })

  it('não exibe o aviso quando não é o próprio usuário', () => {
    render(<AgentRoleCell agent={makeAgent()} canEdit isSelf={false} />)
    expect(screen.queryByText(/só vale após novo login/i)).not.toBeInTheDocument()
  })
})
