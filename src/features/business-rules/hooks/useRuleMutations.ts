import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '../../../components/ui/Toast'
import { handleApiError } from '../../../utils/handleApiError'
import { saveBusinessRule } from '../services/businessRulesService'
import { businessRulesKeys } from './useBusinessRules'
import type { RuleValue } from '../types/businessRule'

type SaveRuleArgs = {
  ruleId: string | null
  teamId: string | null
  chave: string
  valor: RuleValue
}

/**
 * Mutation de upsert de regra (global ou por equipe).
 * Invalida a query do escopo afetado (global ou da equipe) no sucesso e dispara toast "Salvo".
 */
export function useRuleMutations() {
  const queryClient = useQueryClient()
  const toast = useToast()

  return useMutation({
    mutationFn: (args: SaveRuleArgs) => saveBusinessRule(args),
    onSuccess: (_data, variables) => {
      toast.success('Salvo.')
      if (variables.teamId) {
        queryClient.invalidateQueries({ queryKey: businessRulesKeys.team(variables.teamId) })
      } else {
        queryClient.invalidateQueries({ queryKey: businessRulesKeys.global })
      }
    },
    onError: (error: unknown) => toast.error(handleApiError(error)),
  })
}
