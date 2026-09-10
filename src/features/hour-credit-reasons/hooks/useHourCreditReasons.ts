import { useQuery } from '@tanstack/react-query'
import { listHourCreditReasons } from '../services/hourCreditReasonsService'

/**
 * Prefixo da chave de cache dos motivos. Exportado para que a invalidação das mutations e
 * as duas telas consumidoras (Motivos e o formulário de Créditos) partam da MESMA fonte —
 * chave digitada duas vezes é como a invalidação deixa de alcançar o consumidor.
 */
export const HOUR_CREDIT_REASONS_QUERY_KEY = 'hour-credit-reasons'

/**
 * Lista os motivos de crédito (132/F6).
 *
 * `includeInactive` entra na chave: são **conjuntos diferentes** de dados sob a mesma
 * origem. A `queryFn` é a mesma função (`listHourCreditReasons`) nos dois casos, então não
 * há duas fontes escrevendo na mesma entrada de cache — o defeito que
 * `queryKeyRegistry.test.ts` existe para pegar.
 *
 * - Tela de Motivos: `true` (a lista mostra ativos e inativos, com a situação na coluna).
 * - Combo de motivo no formulário de Crédito: `false` (não se cria crédito com motivo
 *   morto — o backend devolve `404` para motivo inativo, `analise-backend.md` §7.2).
 */
export function useHourCreditReasons(includeInactive: boolean) {
  return useQuery({
    queryKey: [HOUR_CREDIT_REASONS_QUERY_KEY, { includeInactive }],
    queryFn: () => listHourCreditReasons(includeInactive),
  })
}
