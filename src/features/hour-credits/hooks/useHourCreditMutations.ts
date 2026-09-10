import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '../../../components/ui/Toast'
import {
  createHourCredit,
  deleteHourCredit,
  updateHourCredit,
} from '../services/hourCreditsService'
import { getHourCreditErrorMessage } from '../utils/hourCreditErrorMessage'
import type { EditarCreditoFormValues, NovoCreditoFormValues } from '../types/hourCredit'
import { HOUR_CREDITS_QUERY_KEY } from './useHourCredits'

/**
 * Chaves invalidadas por toda mutation de crédito — levantadas por varredura
 * (`grep -rn "'hour-credits'\|plan-consumption" src/`), não de memória:
 *
 * | Chave | Onde |
 * |---|---|
 * | `['hour-credits', …]` | esta tela — `useHourCredits.ts` (prefixo do `useServerTable`) |
 * | `['plan-consumption', …]` | Consumo de Planos: a coluna `15h + 2h` exibe o crédito do mês |
 *
 * O casamento é por **prefixo**, então `['hour-credits']` alcança toda combinação de
 * página/ordenação/filtro montada pelo `useServerTable`.
 *
 * ⚠️ `plan-consumption` é da unidade F4 e está sendo alterada em paralelo: invalidar a
 * chave **não** toca no arquivo dela — é só cache. Sem isso, lançar um crédito manual
 * deixaria a tela de Consumo de Planos exibindo o plano antigo até um reload.
 */
const CHAVES_DEPENDENTES = [[HOUR_CREDITS_QUERY_KEY], ['plan-consumption']] as const

/** Criar, editar e excluir crédito de horas (132/F5). */
export function useHourCreditMutations() {
  const queryClient = useQueryClient()
  const toast = useToast()

  function invalidate() {
    for (const queryKey of CHAVES_DEPENDENTES) {
      queryClient.invalidateQueries({ queryKey })
    }
  }

  const create = useMutation({
    mutationFn: (values: NovoCreditoFormValues) => createHourCredit(values),
    onSuccess: () => {
      // O texto não afirma a competência: ela é DERIVADA no servidor (a corrente), e o
      // painel não a conhece antes da resposta (`AP-FRONTEND-022`).
      toast.success('Crédito lançado.')
      invalidate()
    },
    onError: (error: unknown) => toast.error(getHourCreditErrorMessage(error)),
  })

  const update = useMutation({
    mutationFn: ({ id, ...values }: { id: number } & EditarCreditoFormValues) =>
      updateHourCredit(id, values),
    onSuccess: () => {
      toast.success('Crédito atualizado.')
      invalidate()
    },
    onError: (error: unknown) => toast.error(getHourCreditErrorMessage(error)),
  })

  const remove = useMutation({
    mutationFn: (id: number) => deleteHourCredit(id),
    onSuccess: () => {
      toast.success('Crédito removido.')
      invalidate()
    },
    onError: (error: unknown) => toast.error(getHourCreditErrorMessage(error)),
  })

  return { create, update, remove }
}
