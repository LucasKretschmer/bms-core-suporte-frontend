import { z } from 'zod'

/**
 * Schema do diálogo de exclusão de apontamento (047) — fonte da verdade da
 * validação de UX. O backend é a fonte definitiva (revalida o motivo e audita).
 *
 * Regra de UX: motivo obrigatório, mínimo de 5 caracteres (alinhado ao contrato
 * do backend) e máximo de 500 para evitar payloads abusivos.
 */
export const DELETE_REASON_MIN = 5
export const DELETE_REASON_MAX = 500

export const deleteTimeEntrySchema = z.object({
  reason: z
    .string()
    .trim()
    .min(DELETE_REASON_MIN, `Informe o motivo (mínimo de ${DELETE_REASON_MIN} caracteres).`)
    .max(DELETE_REASON_MAX, `O motivo deve ter no máximo ${DELETE_REASON_MAX} caracteres.`),
})

export type DeleteTimeEntryFormValues = z.infer<typeof deleteTimeEntrySchema>
