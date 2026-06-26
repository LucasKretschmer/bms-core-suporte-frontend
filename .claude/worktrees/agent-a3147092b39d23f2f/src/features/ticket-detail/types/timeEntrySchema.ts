import { z } from 'zod'

/**
 * Schema do TimeEntryModal (F4) — fonte da verdade da validação de UX.
 * O backend é a fonte de verdade definitiva (recalcula pausa/total e revalida).
 *
 * Regras de UX:
 *  - atendente e categorização obrigatórios;
 *  - ao menos 1 bloco; cada bloco com início e fim; fim > início;
 *  - sem sobreposição entre blocos (ordena por início antes de checar — blocos
 *    retroativos em qualquer ordem são aceitos).
 */

const workBlockSchema = z
  .object({
    start: z.string().min(1, 'Informe o início.'),
    end: z.string().min(1, 'Informe o fim.'),
  })
  .refine(
    (w) => {
      if (!w.start || !w.end) return true // erro de obrigatoriedade tratado acima
      const s = new Date(w.start)
      const e = new Date(w.end)
      if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return false
      return e > s
    },
    { message: 'O fim deve ser maior que o início.', path: ['end'] },
  )

export const timeEntrySchema = z
  .object({
    userId: z.string().min(1, 'Selecione o atendente.'),
    serviceCategoryId: z
      .string()
      .min(1, 'Selecione a categorização do atendimento.'),
    billableOutsidePlan: z.boolean(),
    note: z.string().max(2000, 'A observação deve ter no máximo 2000 caracteres.').optional(),
    works: z.array(workBlockSchema).min(1, 'Adicione ao menos um apontamento.'),
  })
  .superRefine((val, ctx) => {
    // Sobreposição: ordena por início e valida que start[i] >= end[i-1].
    const parsed = val.works
      .map((w, i) => ({
        i,
        s: new Date(w.start),
        e: new Date(w.end),
      }))
      .filter((b) => !Number.isNaN(b.s.getTime()) && !Number.isNaN(b.e.getTime()))
      .sort((a, b) => a.s.getTime() - b.s.getTime())

    for (let k = 1; k < parsed.length; k++) {
      if (parsed[k].s < parsed[k - 1].e) {
        ctx.addIssue({
          code: 'custom',
          message:
            'Há apontamentos com horários sobrepostos. Ajuste para que não se cruzem.',
          path: ['works', parsed[k].i, 'start'],
        })
      }
    }
  })

export type TimeEntryFormValues = z.infer<typeof timeEntrySchema>
