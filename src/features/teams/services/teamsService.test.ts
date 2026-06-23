import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../services/api', () => ({ api: { get: vi.fn() } }))

import { api } from '../../../services/api'
import { listAgents } from './teamsService'
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
})
