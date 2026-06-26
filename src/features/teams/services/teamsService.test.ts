import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../services/api', () => ({ api: { get: vi.fn(), patch: vi.fn() } }))

import { api } from '../../../services/api'
import { listAgents, updateAgentRole } from './teamsService'
import { ROLE_CODE } from '../types/agentRole'
import type { AgentDto } from '../types/team'

const agent: AgentDto = {
  userId: 1,
  nome: 'Ana',
  email: 'ana@x.com',
  equipeId: 5,
  equipeNome: 'Suporte',
  papel: 'ATENDENTE',
}

describe('teamsService', () => {
  beforeEach(() => vi.clearAllMocks())

  it('desempacota ApiResponse { data } de /teams/members', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: { data: [agent] } })

    const result = await listAgents()

    expect(api.get).toHaveBeenCalledWith('/api/v1/teams/members')
    expect(result).toEqual([agent])
  })

  describe('updateAgentRole (#13)', () => {
    it('faz PATCH em /users/{id}/role com body { role } e desempacota data.data', async () => {
      const updated: AgentDto = { ...agent, userId: 7, papel: 'GERENTE' }
      vi.mocked(api.patch).mockResolvedValueOnce({ data: { data: updated } })

      const result = await updateAgentRole(7, ROLE_CODE.Gerente)

      expect(api.patch).toHaveBeenCalledWith('/api/v1/users/7/role', { role: 3 })
      expect(result).toEqual(updated)
    })

    it('envia o código de Atendente (1) quando recebido', async () => {
      vi.mocked(api.patch).mockResolvedValueOnce({ data: { data: agent } })

      await updateAgentRole(42, ROLE_CODE.Atendente)

      expect(api.patch).toHaveBeenCalledWith('/api/v1/users/42/role', { role: 1 })
    })
  })
})
