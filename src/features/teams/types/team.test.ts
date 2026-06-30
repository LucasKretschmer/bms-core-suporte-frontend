import { describe, expect, it } from 'vitest'
import { groupAgentsByTeam, type AgentDto, type AgentTeamDto } from './team'

function makeAgent(over: Partial<AgentDto>): AgentDto {
  return {
    userId: 1,
    nome: 'Nome',
    email: null,
    equipeId: null,
    equipeNome: null,
    papel: 'ATENDENTE',
    equipes: [],
    ...over,
  }
}

function team(id: number, nome: string, isPrimary = false): AgentTeamDto {
  return { id, nome, isPrimary }
}

describe('groupAgentsByTeam', () => {
  it('agrupa atendentes por equipe', () => {
    const agents = [
      makeAgent({ userId: 1, nome: 'Ana', equipes: [team(1, 'Suporte', true)] }),
      makeAgent({ userId: 2, nome: 'Bia', equipes: [team(1, 'Suporte', true)] }),
      makeAgent({ userId: 3, nome: 'Caio', equipes: [team(2, 'Onboarding', true)] }),
    ]

    const groups = groupAgentsByTeam(agents)

    expect(groups).toHaveLength(2)
    const suporte = groups.find((g) => g.id === 1)
    expect(suporte?.membros).toHaveLength(2)
    expect(suporte?.nome).toBe('Suporte')
  })

  it('035 — o mesmo atendente aparece em TODAS as suas equipes', () => {
    const agents = [
      makeAgent({
        userId: 1,
        nome: 'Ana',
        equipes: [team(1, 'Suporte', true), team(2, 'Onboarding', false)],
      }),
    ]

    const groups = groupAgentsByTeam(agents)

    expect(groups).toHaveLength(2)
    const suporte = groups.find((g) => g.id === 1)
    const onboarding = groups.find((g) => g.id === 2)
    expect(suporte?.membros.map((m) => m.userId)).toContain(1)
    expect(onboarding?.membros.map((m) => m.userId)).toContain(1)
  })

  it('035 — marca a equipe principal por membro (isPrimary)', () => {
    const agents = [
      makeAgent({
        userId: 1,
        nome: 'Ana',
        equipes: [team(1, 'Suporte', true), team(2, 'Onboarding', false)],
      }),
    ]

    const groups = groupAgentsByTeam(agents)

    const anaNoSuporte = groups.find((g) => g.id === 1)?.membros.find((m) => m.userId === 1)
    const anaNoOnboarding = groups.find((g) => g.id === 2)?.membros.find((m) => m.userId === 1)
    expect(anaNoSuporte?.isPrimary).toBe(true)
    expect(anaNoOnboarding?.isPrimary).toBe(false)
  })

  it('usuário sem equipe vai para grupo "Sem equipe"', () => {
    const groups = groupAgentsByTeam([makeAgent({ userId: 1, nome: 'Ana', equipes: [] })])
    expect(groups[0].nome).toBe('Sem equipe')
    expect(groups[0].id).toBeNull()
    expect(groups[0].membros[0].isPrimary).toBe(false)
  })

  it('ordena equipes por nome (pt-BR)', () => {
    const agents = [
      makeAgent({ userId: 1, equipes: [team(2, 'Onboarding', true)] }),
      makeAgent({ userId: 2, equipes: [team(1, 'Atendimento', true)] }),
    ]
    const groups = groupAgentsByTeam(agents)
    expect(groups.map((g) => g.nome)).toEqual(['Atendimento', 'Onboarding'])
  })

  it('lista vazia → nenhum grupo', () => {
    expect(groupAgentsByTeam([])).toEqual([])
  })
})
