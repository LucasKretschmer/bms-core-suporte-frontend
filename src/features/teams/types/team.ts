/**
 * DTOs de Equipes e Atendentes (B5).
 * Somente leitura — dados sincronizados do HubSpot.
 *
 * GET /api/v1/teams/members → ApiResponse<AgentDto[]>
 * GET /api/v1/teams         → ApiResponse<TeamDto[]>  (já existe em reportsService)
 */
export type AgentDto = {
  userId: number
  nome: string
  email: string | null
  equipeId: number | null
  equipeNome: string | null
  /** "GERENTE" | "COORDENADOR" | "ATENDENTE" | "ADMIN" — vem pronto do backend */
  papel: string
}

/** Equipe com seus membros — agrupado no client a partir de AgentDto[]. */
export type TeamWithMembers = {
  id: number | null
  nome: string
  membros: { userId: number; nome: string; papel: string }[]
}

/** Agrupa atendentes por equipe para os cards. Usuários sem equipe ficam num grupo "Sem equipe". */
export function groupAgentsByTeam(agents: AgentDto[]): TeamWithMembers[] {
  const map = new Map<string, TeamWithMembers>()

  for (const agent of agents) {
    const key = agent.equipeId !== null ? String(agent.equipeId) : '__sem_equipe__'
    const existing = map.get(key)
    if (existing) {
      existing.membros.push({ userId: agent.userId, nome: agent.nome, papel: agent.papel })
    } else {
      map.set(key, {
        id: agent.equipeId,
        nome: agent.equipeNome ?? 'Sem equipe',
        membros: [{ userId: agent.userId, nome: agent.nome, papel: agent.papel }],
      })
    }
  }

  return Array.from(map.values()).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
}
