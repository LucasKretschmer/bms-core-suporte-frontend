import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '../../../components/ui/Toast'
import {
  closeBillingPeriod,
  reopenBillingPeriod,
} from '../services/billingPeriodsService'
import type { ReabrirCompetenciaBody } from '../types/billingPeriod'
import { getBillingPeriodErrorMessage } from '../utils/billingPeriodErrorMessage'
import { BILLING_PERIODS_QUERY_KEY } from './useBillingPeriods'
import { BILLING_PERIOD_COMPARISON_QUERY_KEY } from './useBillingPeriodComparison'

/**
 * Chaves que mudam de valor quando uma competência fecha ou reabre — levantadas por
 * varredura, não de memória:
 *
 * | Chave | Por quê |
 * |---|---|
 * | `billing-periods` | a própria listagem (estado, versão, datas) |
 * | `billing-period-comparison` | refechar grava uma versão nova do snapshot |
 * | `plan-consumption` | D12: a tela do mês passa de ao vivo para snapshot (e vice-versa) |
 * | `hour-credits` | C-8: após refechar, o crédito divergente sai **marcado** na listagem |
 *
 * `hour-credits` é a chave da tela de Créditos (unidade F5, em desenvolvimento). Invalidar
 * uma chave que ainda não tem leitor é inócuo — **não** invalidar depois que ela tiver é
 * a gerente olhando uma lista sem as marcas de divergência que acabou de provocar.
 */
const CHAVES_DEPENDENTES = [
  [BILLING_PERIODS_QUERY_KEY],
  [BILLING_PERIOD_COMPARISON_QUERY_KEY],
  ['plan-consumption'],
  ['hour-credits'],
] as const

/**
 * Fechar / reabrir competência (D17 · C-8).
 *
 * 🔴 Nenhum toast desta função afirma que algum crédito foi corrigido: **nada é corrigido**
 * (C-8). Refechar revalida e **reporta**.
 */
export function useBillingPeriodMutations() {
  const queryClient = useQueryClient()
  const toast = useToast()

  function invalidate() {
    for (const queryKey of CHAVES_DEPENDENTES) {
      queryClient.invalidateQueries({ queryKey })
    }
  }

  const fechar = useMutation({
    mutationFn: (competencia: string) => closeBillingPeriod(competencia),
    onSuccess: () => {
      toast.success('Competência fechada. Os números do mês foram congelados no snapshot.')
      invalidate()
    },
    onError: (error: unknown) => toast.error(getBillingPeriodErrorMessage(error)),
  })

  const reabrir = useMutation({
    mutationFn: ({
      competencia,
      ...body
    }: { competencia: string } & ReabrirCompetenciaBody) =>
      reopenBillingPeriod(competencia, body),
    onSuccess: () => {
      // A frase diz o que aconteceu e o que NÃO aconteceu — os créditos seguem intactos.
      toast.success('Competência reaberta. Nenhum crédito foi alterado.')
      invalidate()
    },
    // O erro NÃO vira toast aqui: o `409 COMPETENCIA_COM_CREDITOS_DEPENDENTES` é estado de
    // negócio e é renderizado DENTRO do diálogo (mesma lógica de `rules/api.md` § "402 e
    // 429 não passam pelo interceptor global"). Quem chama decide o que exibir.
  })

  return { fechar, reabrir }
}
