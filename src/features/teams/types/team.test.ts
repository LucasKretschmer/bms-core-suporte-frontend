import { describe, expect, it } from 'vitest'
import { groupAgentsByTeam, type AgentDto } from './team'

function makeAgent(over: Partial<AgentDto>): AgentDto {
  return {
    userId: 1,
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
      makeAgent({ userId: 1, nome: 'Ana', equipeId: 1, equipeNome: 'Suporte' }),
      makeAgent({ userId: 2, nome: 'Bia', equipeId: 1, equipeNome: 'Suporte' }),
      makeAgent({ userId: 3, nome: 'Caio', equipeId: 2, equipeNome: 'Onboarding' }),
    ]

    const groups = groupAgentsByTeam(agents)

    expect(groups).toHaveLength(2)
    const suporte = groups.find((g) => g.id === 1)
    expect(suporte?.membros).toHaveLength(2)
    expect(suporte?.nome).toBe('Suporte')
  })

  it('usuário sem equipe vai para grupo "Sem equipe"', () => {
    const groups = groupAgentsByTeam([makeAgent({ userId: 1, nome: 'Ana' })])
    expect(groups[0].nome).toBe('Sem equipe')
    expect(groups[0].id).toBeNull()
  })

  it('ordena equipes por nome (pt-BR)', () => {
    const agents = [
      makeAgent({ userId: 1, equipeId: 2, equipeNome: 'Onboarding' }),
      makeAgent({ userId: 2, equipeId: 1, equipeNome: 'Atendimento' }),
    ]
    const groups = groupAgentsByTeam(agents)
    expect(groups.map((g) => g.nome)).toEqual(['Atendimento', 'Onboarding'])
  })

  it('lista vazia → nenhum grupo', () => {
    expect(groupAgentsByTeam([])).toEqual([])
  })
})
