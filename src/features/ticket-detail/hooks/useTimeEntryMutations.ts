import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  createManualTimeEntry,
  deleteTimeEntry,
  updateManualTimeEntry,
  type WorkBlockPayload,
} from '../services/timeEntryService'
import { localInputToIso } from '../utils/dateConvert'
import type { TimeEntryFormValues } from '../types/timeEntrySchema'

/**
 * Mutations de apontamento manual (B7). Converte blocos datetime-local → ISO Z (R3),
 * gera Idempotency-Key por submit (R7) e invalida as queries do detalhe no sucesso.
 */

/** Converte os blocos do form (naive local) para o payload ISO Z. */
export function toWorkBlocksPayload(works: TimeEntryFormValues['works']): WorkBlockPayload[] {
  return works.map((w) => ({
    start: localInputToIso(w.start),
    end: localInputToIso(w.end),
  }))
}

export function useTimeEntryMutations(ticketId: string) {
  const queryClient = useQueryClient()

  function invalidateDetail() {
    void queryClient.invalidateQueries({ queryKey: ['ticket-time-entries', ticketId] })
    void queryClient.invalidateQueries({ queryKey: ['ticket-detail', ticketId] })
  }

  const create = useMutation({
    mutationFn: (values: TimeEntryFormValues) => {
      const idempotencyKey = crypto.randomUUID()
      return createManualTimeEntry(
        {
          ticketId,
          userId: values.userId,
          serviceCategoryId: values.serviceCategoryId,
          billableOutsidePlan: values.billableOutsidePlan,
          note: values.note?.trim() ? values.note.trim() : undefined,
          works: toWorkBlocksPayload(values.works),
        },
        idempotencyKey,
      )
    },
    onSuccess: invalidateDetail,
  })

  const update = useMutation({
    mutationFn: ({ id, values }: { id: string; values: TimeEntryFormValues }) =>
      updateManualTimeEntry(id, {
        serviceCategoryId: values.serviceCategoryId,
        billableOutsidePlan: values.billableOutsidePlan,
        note: values.note?.trim() ? values.note.trim() : undefined,
        works: toWorkBlocksPayload(values.works),
      }),
    onSuccess: invalidateDetail,
  })

  const remove = useMutation({
    mutationFn: (id: string) => deleteTimeEntry(id),
    onSuccess: invalidateDetail,
  })

  return { create, update, remove }
}
