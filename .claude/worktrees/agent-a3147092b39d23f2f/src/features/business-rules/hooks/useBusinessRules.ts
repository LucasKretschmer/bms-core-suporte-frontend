import { useQueries, useQuery } from '@tanstack/react-query'
import { listTeams } from '../../reports/shared/services/reportsService'
import { listBusinessRules } from '../services/businessRulesService'
import type { BusinessRuleDto } from '../types/businessRule'

export const businessRulesKeys = {
  global: ['business-rules', 'global'] as const,
  team: (teamId: number) => ['business-rules', 'team', teamId] as const,
  teamsList: ['teams'] as const,
}

/** Regras globais (teamId == null). */
export function useGlobalRules() {
  return useQuery({
    queryKey: businessRulesKeys.global,
    queryFn: () => listBusinessRules(null),
  })
}

/** Lista de equipes (cabeçalho dos cards). Reusa o service de relatórios. */
export function useTeamsList() {
  return useQuery({
    queryKey: businessRulesKeys.teamsList,
    queryFn: () => listTeams(),
  })
}

/**
 * Regras de cada equipe — uma query por equipe (N+1 aceitável; B6 agregado é opcional).
 * Retorna um mapa teamId → { rules, isLoading, isError }.
 */
export function useTeamRules(teamIds: number[]) {
  const queries = useQueries({
    queries: teamIds.map((teamId) => ({
      queryKey: businessRulesKeys.team(teamId),
      queryFn: () => listBusinessRules(teamId),
    })),
  })

  const byTeam: Record<
    number,
    { rules: BusinessRuleDto[]; isLoading: boolean; isError: boolean }
  > = {}

  teamIds.forEach((teamId, i) => {
    const q = queries[i]
    byTeam[teamId] = {
      rules: q.data ?? [],
      isLoading: q.isLoading,
      isError: q.isError,
    }
  })

  return byTeam
}
