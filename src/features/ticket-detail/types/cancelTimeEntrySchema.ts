import { z } from 'zod'

/**
 * Schema do diálogo de cancelamento de apontamento (099) — fonte da verdade da
 * validação de UX. O backend é a fonte definitiva (revalida o motivo e audita).
 *
 * Regra de UX: motivo obrigatório, mínimo de 10 caracteres (alinhado ao contrato
 * do backend — POST /time-entries/{id}/cancel) e máximo de 500 para evitar
 * payloads abusivos.
 */
export const CANCEL_REASON_MIN = 10
export const CANCEL_REASON_MAX = 500

export const cancelTimeEntrySchema = z.object({
  reason: z
    .string()
    .trim()
    .min(CANCEL_REASON_MIN, `Informe o motivo (mínimo de ${CANCEL_REASON_MIN} caracteres).`)
    .max(CANCEL_REASON_MAX, `O motivo deve ter no máximo ${CANCEL_REASON_MAX} caracteres.`),
})

export type CancelTimeEntryFormValues = z.infer<typeof cancelTimeEntrySchema>
