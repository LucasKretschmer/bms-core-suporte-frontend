import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '../../../components/ui/Toast'
import {
  createHourCreditReason,
  deleteHourCreditReason,
  updateHourCreditReason,
} from '../services/hourCreditReasonsService'
import { getHourCreditReasonErrorMessage } from '../utils/hourCreditReasonErrorMessage'
import { HOUR_CREDIT_REASONS_QUERY_KEY } from './useHourCreditReasons'

/**
 * Chaves invalidadas por toda mutation de motivo — levantadas por varredura
 * (`grep hour-credit` em `src/`), não de memória:
 *
 * | Chave | Onde |
 * |---|---|
 * | `['hour-credit-reasons', {includeInactive}]` | esta tela **e** o combo do formulário de crédito |
 * | `['hour-credits', …]` | a tabela de créditos exibe `motivoNome`; renomear muda o texto de linhas já carregadas |
 *
 * O casamento do TanStack Query é por **prefixo**, então invalidar
 * `['hour-credit-reasons']` alcança as duas variantes de `includeInactive`.
 */
const CHAVES_DEPENDENTES = [[HOUR_CREDIT_REASONS_QUERY_KEY], ['hour-credits']] as const

/** Criar, renomear e excluir motivo de crédito (132/F6). */
export function useHourCreditReasonMutations() {
  const queryClient = useQueryClient()
  const toast = useToast()

  function invalidate() {
    for (const queryKey of CHAVES_DEPENDENTES) {
      queryClient.invalidateQueries({ queryKey })
    }
  }

  const create = useMutation({
    mutationFn: (nome: string) => createHourCreditReason(nome),
    onSuccess: () => {
      toast.success('Motivo adicionado.')
      invalidate()
    },
    onError: (error: unknown) => toast.error(getHourCreditReasonErrorMessage(error)),
  })

  const update = useMutation({
    mutationFn: ({ id, nome }: { id: number; nome: string }) => updateHourCreditReason(id, nome),
    onSuccess: () => {
      toast.success('Motivo atualizado.')
      invalidate()
    },
    onError: (error: unknown) => toast.error(getHourCreditReasonErrorMessage(error)),
  })

  const remove = useMutation({
    mutationFn: (id: number) => deleteHourCreditReason(id),
    onSuccess: () => {
      toast.success('Motivo removido.')
      invalidate()
    },
    // 409 MOTIVO_DE_SISTEMA / MOTIVO_EM_USO chegam por aqui: `handleApiError` diria só o
    // que o servidor mandou, sem a ação. A rede de segurança da UI (ação bloqueada na
    // linha) não cobre o motivo semeado de um backend que ainda não manda `isSistema`.
    onError: (error: unknown) => toast.error(getHourCreditReasonErrorMessage(error)),
  })

  return { create, update, remove }
}
