import { describe, expect, it } from 'vitest'
import {
  agentMatchesFilters,
  filterAgents,
  groupAgentsByTeam,
  listTeamOptions,
  SEM_EQUIPE_FILTER_VALUE,
  type AgentDto,
  type AgentTeamDto,
  type TeamsFilters,
} from './team'

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

// 037 — filtros de tela (busca + equipe)
function filters(over: Partial<TeamsFilters> = {}): TeamsFilters {
  return { search: '', equipeId: null, ...over }
}

describe('agentMatchesFilters', () => {
  const ana = makeAgent({
    userId: 1,
    nome: 'Ana Souza',
    email: 'ana.souza@empresa.com',
    equipes: [team(1, 'Suporte', true)],
  })

  it('sem filtros → mantém o atendente', () => {
    expect(agentMatchesFilters(ana, filters())).toBe(true)
  })

  it('busca por nome (case-insensitive)', () => {
    expect(agentMatchesFilters(ana, filters({ search: 'ana' }))).toBe(true)
    expect(agentMatchesFilters(ana, filters({ search: 'SOUZA' }))).toBe(true)
    expect(agentMatchesFilters(ana, filters({ search: 'carlos' }))).toBe(false)
  })

  it('busca por e-mail (case-insensitive)', () => {
    expect(agentMatchesFilters(ana, filters({ search: 'EMPRESA.com' }))).toBe(true)
    expect(agentMatchesFilters(ana, filters({ search: 'ana.souza@' }))).toBe(true)
    expect(agentMatchesFilters(ana, filters({ search: 'outrodominio' }))).toBe(false)
  })

  it('busca ignora espaços nas pontas (trim)', () => {
    expect(agentMatchesFilters(ana, filters({ search: '  ana  ' }))).toBe(true)
    expect(agentMatchesFilters(ana, filters({ search: '   ' }))).toBe(true)
  })

  it('e-mail null não quebra a busca por nome', () => {
    const semEmail = makeAgent({ userId: 2, nome: 'Bia', email: null })
    expect(agentMatchesFilters(semEmail, filters({ search: 'bia' }))).toBe(true)
    expect(agentMatchesFilters(semEmail, filters({ search: '@' }))).toBe(false)
  })

  it('filtra por equipe (id)', () => {
    expect(agentMatchesFilters(ana, filters({ equipeId: 1 }))).toBe(true)
    expect(agentMatchesFilters(ana, filters({ equipeId: 99 }))).toBe(false)
  })

  it('filtra pelo grupo "Sem equipe"', () => {
    const semEquipe = makeAgent({ userId: 3, nome: 'Caio', equipes: [] })
    expect(agentMatchesFilters(semEquipe, filters({ equipeId: SEM_EQUIPE_FILTER_VALUE }))).toBe(true)
    expect(agentMatchesFilters(ana, filters({ equipeId: SEM_EQUIPE_FILTER_VALUE }))).toBe(false)
  })

  it('combina busca e equipe com AND', () => {
    expect(agentMatchesFilters(ana, filters({ search: 'ana', equipeId: 1 }))).toBe(true)
    // nome bate, equipe não
    expect(agentMatchesFilters(ana, filters({ search: 'ana', equipeId: 99 }))).toBe(false)
    // equipe bate, nome não
    expect(agentMatchesFilters(ana, filters({ search: 'carlos', equipeId: 1 }))).toBe(false)
  })
})

describe('filterAgents', () => {
  const agents = [
    makeAgent({ userId: 1, nome: 'Ana', email: 'ana@x.com', equipes: [team(1, 'Suporte', true)] }),
    makeAgent({ userId: 2, nome: 'Bia', email: 'bia@x.com', equipes: [team(2, 'Onboarding', true)] }),
    makeAgent({ userId: 3, nome: 'Caio', email: 'caio@y.com', equipes: [] }),
  ]

  it('aplica busca por nome', () => {
    const result = filterAgents(agents, filters({ search: 'bia' }))
    expect(result.map((a) => a.userId)).toEqual([2])
  })

  it('aplica filtro por equipe', () => {
    const result = filterAgents(agents, filters({ equipeId: 1 }))
    expect(result.map((a) => a.userId)).toEqual([1])
  })

  it('combina busca + equipe (AND)', () => {
    const result = filterAgents(agents, filters({ search: '@x.com', equipeId: 2 }))
    expect(result.map((a) => a.userId)).toEqual([2])
  })

  it('estado vazio — nenhum atendente quando o filtro não casa', () => {
    expect(filterAgents(agents, filters({ search: 'inexistente' }))).toEqual([])
    expect(filterAgents(agents, filters({ equipeId: 999 }))).toEqual([])
  })
})

describe('listTeamOptions', () => {
  it('deriva equipes únicas ordenadas por nome', () => {
    const agents = [
      makeAgent({ userId: 1, equipes: [team(2, 'Onboarding', true)] }),
      makeAgent({ userId: 2, equipes: [team(1, 'Atendimento', true), team(2, 'Onboarding', false)] }),
    ]
    const options = listTeamOptions(agents)
    expect(options).toEqual([
      { id: 1, nome: 'Atendimento' },
      { id: 2, nome: 'Onboarding' },
    ])
  })

  it('inclui "Sem equipe" quando há atendente sem equipe', () => {
    const agents = [
      makeAgent({ userId: 1, equipes: [team(1, 'Suporte', true)] }),
      makeAgent({ userId: 2, equipes: [] }),
    ]
    const options = listTeamOptions(agents)
    expect(options).toEqual([
      { id: 1, nome: 'Suporte' },
      { id: SEM_EQUIPE_FILTER_VALUE, nome: 'Sem equipe' },
    ])
  })

  it('lista vazia → nenhuma opção', () => {
    expect(listTeamOptions([])).toEqual([])
  })
})
