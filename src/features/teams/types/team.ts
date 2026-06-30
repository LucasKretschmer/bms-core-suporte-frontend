/**
 * DTOs de Equipes e Atendentes (B5).
 * Somente leitura — dados sincronizados do HubSpot.
 *
 * GET /api/v1/teams/members → ApiResponse<AgentDto[]>
 * GET /api/v1/teams         → ApiResponse<TeamDto[]>  (já existe em reportsService)
 *
 * 035 — um atendente pode pertencer a N equipes (junção `teammembers`).
 *        `equipes` traz todas as equipes ativas (principal primeiro);
 *        `equipeId`/`equipeNome` permanecem como a equipe PRINCIPAL (retrocompat).
 */

/** Uma equipe à qual o atendente pertence. */
export type AgentTeamDto = {
  id: number
  nome: string
  /** Marca a equipe principal do atendente (User.PrimaryTeamId). */
  isPrimary: boolean
}

export type AgentDto = {
  userId: number
  nome: string
  email: string | null
  /** Equipe principal (retrocompat) — null quando o atendente não tem equipe. */
  equipeId: number | null
  /** Nome da equipe principal (retrocompat) — null quando sem equipe. */
  equipeNome: string | null
  /** "GERENTE" | "COORDENADOR" | "ATENDENTE" | "ADMIN" — vem pronto do backend */
  papel: string
  /** 035 — todas as equipes ativas do atendente (principal primeiro). Pode ser []. */
  equipes: AgentTeamDto[]
}

/** Equipe com seus membros — agrupado no client a partir de AgentDto[]. */
export type TeamWithMembers = {
  id: number | null
  nome: string
  membros: { userId: number; nome: string; papel: string; isPrimary: boolean }[]
}

const SEM_EQUIPE_KEY = '__sem_equipe__'

/**
 * Agrupa atendentes por equipe para os cards (035 — multi-equipe).
 *
 * O mesmo atendente aparece em TODAS as suas equipes (`agent.equipes`): para cada
 * equipe da lista, ele entra como membro daquele grupo. Atendentes sem equipe
 * (`equipes: []`) ficam num grupo "Sem equipe".
 *
 * `isPrimary` do membro reflete se aquela é a equipe principal dele.
 */
export function groupAgentsByTeam(agents: AgentDto[]): TeamWithMembers[] {
  const map = new Map<string, TeamWithMembers>()

  for (const agent of agents) {
    if (agent.equipes.length === 0) {
      addMember(map, SEM_EQUIPE_KEY, null, 'Sem equipe', agent, false)
      continue
    }
    for (const equipe of agent.equipes) {
      addMember(map, String(equipe.id), equipe.id, equipe.nome, agent, equipe.isPrimary)
    }
  }

  return Array.from(map.values()).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
}

function addMember(
  map: Map<string, TeamWithMembers>,
  key: string,
  id: number | null,
  nome: string,
  agent: AgentDto,
  isPrimary: boolean,
): void {
  const membro = { userId: agent.userId, nome: agent.nome, papel: agent.papel, isPrimary }
  const existing = map.get(key)
  if (existing) {
    existing.membros.push(membro)
  } else {
    map.set(key, { id, nome, membros: [membro] })
  }
}

/**
 * 037 — Filtros de tela (client-side, sobre os dados já carregados).
 * Não altera o contrato/backend nem o agrupamento da 035; apenas restringe o que é exibido.
 */
export type TeamsFilters = {
  /** Termo de busca por nome OU e-mail (case-insensitive, trim). */
  search: string
  /**
   * Equipe selecionada. `null` = "Todas as equipes".
   * `SEM_EQUIPE_FILTER_VALUE` = atendentes sem equipe.
   */
  equipeId: number | null
}

/** Valor sentinela do seletor para o grupo "Sem equipe". */
export const SEM_EQUIPE_FILTER_VALUE = -1

/** Uma equipe disponível no seletor (derivada dos dados carregados). */
export type TeamOption = { id: number | null; nome: string }

/**
 * Lista as equipes presentes nos dados carregados, ordenadas por nome.
 * Inclui um item "Sem equipe" (id `SEM_EQUIPE_FILTER_VALUE`) quando há
 * atendentes sem equipe — para permitir filtrar por esse grupo.
 */
export function listTeamOptions(agents: AgentDto[]): TeamOption[] {
  const map = new Map<number, string>()
  let hasSemEquipe = false

  for (const agent of agents) {
    if (agent.equipes.length === 0) {
      hasSemEquipe = true
      continue
    }
    for (const equipe of agent.equipes) {
      map.set(equipe.id, equipe.nome)
    }
  }

  const options: TeamOption[] = Array.from(map.entries())
    .map(([id, nome]) => ({ id, nome }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))

  if (hasSemEquipe) {
    options.push({ id: SEM_EQUIPE_FILTER_VALUE, nome: 'Sem equipe' })
  }

  return options
}

/**
 * Aplica os filtros de tela (busca + equipe) a um atendente. AND entre os filtros.
 *
 * - Busca: confere se `nome` OU `email` contém o termo (case-insensitive, trim).
 *   Termo vazio não filtra.
 * - Equipe: `null` não filtra; `SEM_EQUIPE_FILTER_VALUE` mantém só quem não tem
 *   equipe; um id mantém só quem é membro daquela equipe.
 */
export function agentMatchesFilters(agent: AgentDto, filters: TeamsFilters): boolean {
  const term = filters.search.trim().toLowerCase()
  if (term.length > 0) {
    const nome = agent.nome.toLowerCase()
    const email = (agent.email ?? '').toLowerCase()
    if (!nome.includes(term) && !email.includes(term)) return false
  }

  if (filters.equipeId !== null) {
    if (filters.equipeId === SEM_EQUIPE_FILTER_VALUE) {
      if (agent.equipes.length > 0) return false
    } else if (!agent.equipes.some((e) => e.id === filters.equipeId)) {
      return false
    }
  }

  return true
}

/** Filtra a lista de atendentes pelos filtros de tela (037). */
export function filterAgents(agents: AgentDto[], filters: TeamsFilters): AgentDto[] {
  return agents.filter((agent) => agentMatchesFilters(agent, filters))
}
