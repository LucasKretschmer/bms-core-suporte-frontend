import { api } from '../../../services/api'
import type { ApiResponse } from '../../../types/api'
import type { TicketHeaderDto, TicketTimeEntryDto } from '../types/ticketDetail'

/**
 * Serviços do detalhe do ticket (F3). Desempacotam o envelope aqui (R6).
 * Ambos endpoints usam ApiResponse<T> enveloped (B2/B3/B8) → retornar data.data.
 */

/** Header/meta do ticket por UUID interno (B8). */
export async function getTicketById(ticketId: string): Promise<TicketHeaderDto> {
  const { data } = await api.get<ApiResponse<TicketHeaderDto>>(
    `/api/v1/tickets/by-id/${ticketId}`,
  )
  return data.data
}

/** Apontamentos do ticket com nome de agente/categoria e segmentos (B2/B3). */
export async function listTicketTimeEntries(
  ticketId: string,
): Promise<TicketTimeEntryDto[]> {
  const { data } = await api.get<ApiResponse<TicketTimeEntryDto[]>>(
    `/api/v1/tickets/${ticketId}/time-entries`,
  )
  return data.data
}
