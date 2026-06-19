import { useQuery } from '@tanstack/react-query'
import { listAgents } from '../services/teamsService'

export const TEAM_MEMBERS_QUERY_KEY = ['team-members'] as const

/**
 * Lista todos os atendentes com nome, equipe e papel (B5). Somente leitura.
 */
export function useTeamMembers() {
  return useQuery({
    queryKey: TEAM_MEMBERS_QUERY_KEY,
    queryFn: () => listAgents(),
  })
}
