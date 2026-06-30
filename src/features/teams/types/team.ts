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
