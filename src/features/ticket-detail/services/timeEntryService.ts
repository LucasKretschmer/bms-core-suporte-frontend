import { api } from '../../../services/api'
import type { ApiResponse } from '../../../types/api'

/**
 * Serviços de CRUD e ciclo de vida de apontamento manual/retroativo (B7/099).
 *
 * - POST  /api/v1/time-entries/manual              (Idempotency-Key por submit — R7)
 * - PUT   /api/v1/time-entries/manual/{id}
 * - POST  /api/v1/time-entries/{id}/cancel         (motivo obrigatório min 10 — 099)
 * - POST  /api/v1/time-entries/{id}/restore        (sem body — 099)
 *
 * O backend é a fonte de verdade: monta os segmentos PAUSE (gap entre blocos),
 * calcula o total e valida sobreposição. O cliente envia apenas blocos WORK
 * (start/end em ISO Z) — nunca segmentos PAUSE nem totalSeconds.
 *
 * O DELETE (soft-delete 047) foi removido da UI do ticket-detail em favor do par
 * Cancelar/Restaurar (099). O endpoint DELETE permanece no backend, apenas deixou
 * de ser acionado por este frontend.
 */

/** Bloco de trabalho enviado ao backend (ISO Z). */
export type WorkBlockPayload = {
  start: string
  end: string
}

export type CreateManualTimeEntryPayload = {
  ticketId: number
  userId?: number
  serviceCategoryId: number
  billableOutsidePlan: boolean
  note?: string
  works: WorkBlockPayload[]
}

export type UpdateManualTimeEntryPayload = {
  serviceCategoryId: number
  billableOutsidePlan: boolean
  note?: string
  works: WorkBlockPayload[]
}

/** Resposta crua do entry — não precisamos tipar todos os campos (a tela refaz fetch). */
type TimeEntryResponse = { id: number }

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
  id: number,
  payload: UpdateManualTimeEntryPayload,
): Promise<TimeEntryResponse> {
  const { data } = await api.put<ApiResponse<TimeEntryResponse>>(
    `/api/v1/time-entries/manual/${id}`,
    payload,
  )
  return data.data
}

/**
 * Cancela um apontamento informando o motivo (auditado — 099). Suporta COMPLETED
 * (por gestor). O motivo é obrigatório e revalidado no backend (min 10, 422 se curto).
 * Exige Idempotency-Key (evita duplo cancelamento por duplo clique — R3).
 */
export async function cancelTimeEntry(
  id: number,
  note: string,
  idempotencyKey: string,
): Promise<TimeEntryResponse> {
  const { data } = await api.post<ApiResponse<TimeEntryResponse>>(
    `/api/v1/time-entries/${id}/cancel`,
    { note },
    { headers: { 'Idempotency-Key': idempotencyKey } },
  )
  return data.data
}

/**
 * Restaura um apontamento cancelado (CANCELLED → COMPLETED — 099). Sem body.
 * Exige Idempotency-Key (evita duplo restore por duplo clique — R3).
 */
export async function restoreTimeEntry(
  id: number,
  idempotencyKey: string,
): Promise<TimeEntryResponse> {
  const { data } = await api.post<ApiResponse<TimeEntryResponse>>(
    `/api/v1/time-entries/${id}/restore`,
    undefined,
    { headers: { 'Idempotency-Key': idempotencyKey } },
  )
  return data.data
}
