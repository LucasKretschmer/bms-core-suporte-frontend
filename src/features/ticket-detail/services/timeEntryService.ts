import { api } from '../../../services/api'
import type { ApiResponse } from '../../../types/api'

/**
 * Serviços de CRUD de apontamento manual/retroativo (B7).
 *
 * - POST  /api/v1/time-entries/manual        (Idempotency-Key por submit — R7)
 * - PUT   /api/v1/time-entries/manual/{id}
 * - DELETE /api/v1/time-entries/{id}          (soft delete, 204)
 *
 * O backend é a fonte de verdade: monta os segmentos PAUSE (gap entre blocos),
 * calcula o total e valida sobreposição. O cliente envia apenas blocos WORK
 * (start/end em ISO Z) — nunca segmentos PAUSE nem totalSeconds.
 */

/** Bloco de trabalho enviado ao backend (ISO Z). */
export type WorkBlockPayload = {
  start: string
  end: string
}

export type CreateManualTimeEntryPayload = {
  ticketId: string
  userId?: string
  serviceCategoryId: string
  billableOutsidePlan: boolean
  note?: string
  works: WorkBlockPayload[]
}

export type UpdateManualTimeEntryPayload = {
  serviceCategoryId: string
  billableOutsidePlan: boolean
  note?: string
  works: WorkBlockPayload[]
}

/** Resposta crua do entry — não precisamos tipar todos os campos (a tela refaz fetch). */
type TimeEntryResponse = { id: string }

export async function createManualTimeEntry(
  payload: CreateManualTimeEntryPayload,
  idempotencyKey: string,
): Promise<TimeEntryResponse> {
  const { data } = await api.post<ApiResponse<TimeEntryResponse>>(
    '/api/v1/time-entries/manual',
    payload,
    { headers: { 'Idempotency-Key': idempotencyKey } },
  )
  return data.data
}

export async function updateManualTimeEntry(
  id: string,
  payload: UpdateManualTimeEntryPayload,
): Promise<TimeEntryResponse> {
  const { data } = await api.put<ApiResponse<TimeEntryResponse>>(
    `/api/v1/time-entries/manual/${id}`,
    payload,
  )
  return data.data
}

export async function deleteTimeEntry(id: string): Promise<void> {
  await api.delete(`/api/v1/time-entries/${id}`)
}
