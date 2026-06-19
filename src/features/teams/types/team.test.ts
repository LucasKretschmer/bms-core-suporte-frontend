import { describe, expect, it } from 'vitest'
import { groupAgentsByTeam, type AgentDto } from './team'

function makeAgent(over: Partial<AgentDto>): AgentDto {
  return {
    userId: 'u',
    nome: 'Nome',
    email: null,
    equipeId: null,
    equipeNome: null,
    papel: 'ATENDENTE',
    ...over,
  }
}

describe('groupAgentsByTeam', () => {
  it('agrupa atendentes por equipe', () => {
    const agents = [
      makeAgent({ userId: 'u1', nome: 'Ana', equipeId: 't1', equipeNome: 'Suporte' }),
      makeAgent({ userId: 'u2', nome: 'Bia', equipeId: 't1', equipeNome: 'Suporte' }),
      makeAgent({ userId: 'u3', nome: 'Caio', equipeId: 't2', equipeNome: 'Onboarding' }),
    ]

    const groups = groupAgentsByTeam(agents)

    expect(groups).toHaveLength(2)
    const suporte = groups.find((g) => g.id === 't1')
    expect(suporte?.membros).toHaveLength(2)
    expect(suporte?.nome).toBe('Suporte')
  })

  it('usuário sem equipe vai para grupo "Sem equipe"', () => {
    const groups = groupAgentsByTeam([makeAgent({ userId: 'u1', nome: 'Ana' })])
    expect(groups[0].nome).toBe('Sem equipe')
    expect(groups[0].id).toBeNull()
  })

  it('ordena equipes por nome (pt-BR)', () => {
    const agents = [
      makeAgent({ userId: 'u1', equipeId: 't2', equipeNome: 'Onboarding' }),
      makeAgent({ userId: 'u2', equipeId: 't1', equipeNome: 'Atendimento' }),
    ]
    const groups = groupAgentsByTeam(agents)
    expect(groups.map((g) => g.nome)).toEqual(['Atendimento', 'Onboarding'])
  })

  it('lista vazia → nenhum grupo', () => {
    expect(groupAgentsByTeam([])).toEqual([])
  })
})
