import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '../../../components/ui/Toast'
import { getPlanMutationErrorMessage } from '../utils/planErrorMessage'
import { createSupportPlan, updateSupportPlan } from '../services/supportPlansService'
import type { SupportPlanDto, SupportPlanRequest } from '../types/supportPlan'
import { SUPPORT_PLANS_QUERY_KEY, UNMATCHED_PLANS_QUERY_KEY } from './useSupportPlans'

/**
 * Chaves que dependem do cadastro de planos — levantadas por varredura
 * (`grep -rn "support-plans\|plan-health\|plan-consumption" src/`), não de memória:
 *
 * | Chave / prefixo            | Onde                                                        |
 * |----------------------------|-------------------------------------------------------------|
 * | `['support-plans']`        | esta tela **e** `['support-plans','unmatched']` (prefixo)     |
 * | `['metrics-plan-health']`  | `features/dashboards/shared/hooks/usePlanHealth.ts:20-27`    |
 * | `['plan-consumption']`     | `features/reports/plan-consumption/hooks/usePlanConsumption.ts:40` (prefixo montado por `useServerTable.ts:70`) |
 *
 * As duas últimas leem `horasMes` do cadastro
 * (`MetricsQueryRepository.cs:1257`, `ReportQueryRepository.cs:752` —
 * `c.HorasOverride ?? c.SupportPlan.HorasMes`), então editar um plano muda o que elas
 * exibem. Sem esta invalidação o gestor edita o plano e continua vendo o número antigo
 * até um reload — o mesmo defeito corrigido em 123/FE-2 nas categorias.
 *
 * ⚠️ O casamento do TanStack Query é por **prefixo**: invalidar `['support-plans']`
 * alcança `['support-plans','unmatched']`, e não o contrário.
 */
const CHAVES_DEPENDENTES = [
  ['metrics-plan-health'] as const,
  ['plan-consumption'] as const,
]

export type UpdatePlanVariables = { id: number; payload: SupportPlanRequest }

/**
 * Mutations do cadastro de planos: criar (`POST`) e editar (`PUT`).
 *
 * O `onError` usa `getPlanMutationErrorMessage` — **não** `handleApiError` — porque é ele
 * que traduz `422 PLAN_RENAME_UNSAFE` (R-1) numa mensagem acionável. O modal exibe o
 * mesmo texto **inline** e mantém o formulário aberto.
 */
export function useSupportPlanMutations() {
  const queryClient = useQueryClient()
  const toast = useToast()

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: SUPPORT_PLANS_QUERY_KEY })
    // Mantida explicitamente além do prefixo: se a chave do card deixar de começar por
    // 'support-plans', a invalidação dele não some junto em silêncio.
    queryClient.invalidateQueries({ queryKey: UNMATCHED_PLANS_QUERY_KEY })
    for (const queryKey of CHAVES_DEPENDENTES) {
      queryClient.invalidateQueries({ queryKey })
    }
  }

  const create = useMutation<SupportPlanDto, unknown, SupportPlanRequest>({
    mutationFn: (payload) => createSupportPlan(payload),
    onSuccess: () => {
      toast.success('Plano criado.')
      invalidate()
    },
    onError: (error: unknown) => toast.error(getPlanMutationErrorMessage(error)),
  })

  const update = useMutation<SupportPlanDto, unknown, UpdatePlanVariables>({
    mutationFn: ({ id, payload }) => updateSupportPlan(id, payload),
    onSuccess: () => {
      toast.success('Plano atualizado.')
      invalidate()
    },
    onError: (error: unknown) => toast.error(getPlanMutationErrorMessage(error)),
  })

  return { create, update }
}
