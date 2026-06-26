import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '../../../components/ui/Toast'
import { handleApiError } from '../../../utils/handleApiError'
import { updateAgentRole } from '../services/teamsService'
import { profileToRoleCode, type AgentProfile } from '../types/agentRole'
import { TEAM_MEMBERS_QUERY_KEY } from './useTeamMembers'

type UpdateAgentRoleVars = {
  userId: number
  profile: AgentProfile
}

/**
 * Mutation para alterar o perfil (papel) de um atendente (demanda 012 — #13).
 *
 * - Mapeia o perfil de produto → código de role num único ponto (de-para `agentRole.ts`).
 * - Sucesso: toast + invalida a lista de atendentes (sem otimismo que mascare 403/erro).
 * - Erro: toast via `handleApiError` (403 de permissão é tratado de forma genérica e segura).
 *
 * O backend é a fonte de verdade da autorização — a UI apenas reflete o resultado.
 */
export function useUpdateAgentRole() {
  const queryClient = useQueryClient()
  const toast = useToast()

  return useMutation({
    mutationFn: ({ userId, profile }: UpdateAgentRoleVars) =>
      updateAgentRole(userId, profileToRoleCode(profile)),
    onSuccess: () => {
      toast.success('Perfil do atendente atualizado com sucesso.')
      queryClient.invalidateQueries({ queryKey: TEAM_MEMBERS_QUERY_KEY })
    },
    onError: (error: unknown) => {
      toast.error(handleApiError(error))
    },
  })
}
