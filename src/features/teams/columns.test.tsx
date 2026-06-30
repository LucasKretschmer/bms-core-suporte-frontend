import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

// AgentRoleCell depende do hook de mutation (QueryClient/Toast) — mockado aqui,
// pois este teste foca nas colunas (#12 e-mail e fallback de #13), não na célula.
vi.mock('./components/AgentRoleCell', () => ({
  AgentRoleCell: () => <span data-testid="agent-role-cell" />,
}))

import { buildAgentColumns, agentSortValue, formatAgentTeams } from './columns'
import type { AgentDto } from './types/team'

function makeAgent(overrides?: Partial<AgentDto>): AgentDto {
  return {
    userId: 1,
    nome: 'Ana',
    email: 'ana@migrate.info',
    equipeId: 5,
    equipeNome: 'Suporte',
    papel: 'ATENDENTE',
    equipes: [{ id: 5, nome: 'Suporte', isPrimary: true }],
    ...overrides,
  }
}

function renderAccessor(node: React.ReactNode): string {
  const { container } = render(<>{node}</>)
  return container.textContent ?? ''
}

describe('buildAgentColumns', () => {
  it('#12 — inclui a coluna "E-mail"', () => {
    const cols = buildAgentColumns({ canEditRole: false, currentUserId: null })
    const emailCol = cols.find((c) => c.key === 'email')
    expect(emailCol).toBeDefined()
    expect(emailCol?.header).toBe('E-mail')
  })

  it('#12 — accessor de e-mail exibe o e-mail do atendente', () => {
    const cols = buildAgentColumns({ canEditRole: false, currentUserId: null })
    const emailCol = cols.find((c) => c.key === 'email')!
    expect(renderAccessor(emailCol.accessor(makeAgent()))).toBe('ana@migrate.info')
  })

  it('#12 — accessor de e-mail exibe "—" quando e-mail é null', () => {
    const cols = buildAgentColumns({ canEditRole: false, currentUserId: null })
    const emailCol = cols.find((c) => c.key === 'email')!
    expect(renderAccessor(emailCol.accessor(makeAgent({ email: null })))).toBe('—')
  })

  it('#13 — coluna "Perfil" renderiza Badge (somente leitura) quando sem permissão', () => {
    const cols = buildAgentColumns({ canEditRole: false, currentUserId: null })
    const papelCol = cols.find((c) => c.key === 'papel')!
    expect(renderAccessor(papelCol.accessor(makeAgent({ papel: 'GERENTE' })))).toContain('GERENTE')
  })

  it('#13 — coluna "Perfil" renderiza o combobox (AgentRoleCell) quando pode editar', () => {
    const cols = buildAgentColumns({ canEditRole: true, currentUserId: 1 })
    const papelCol = cols.find((c) => c.key === 'papel')!
    const { queryByTestId } = render(<>{papelCol.accessor(makeAgent())}</>)
    expect(queryByTestId('agent-role-cell')).toBeInTheDocument()
  })
})

describe('agentSortValue', () => {
  it('ordena por e-mail', () => {
    expect(agentSortValue(makeAgent({ email: 'z@x.com' }), 'email')).toBe('z@x.com')
  })

  it('e-mail null vira string vazia na ordenação', () => {
    expect(agentSortValue(makeAgent({ email: null }), 'email')).toBe('')
  })
})
