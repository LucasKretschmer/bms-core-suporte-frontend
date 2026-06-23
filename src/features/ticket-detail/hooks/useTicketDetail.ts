import { useQuery } from '@tanstack/react-query'
import { getTicketById } from '../services/ticketDetailService'
import type { TicketHeaderDto } from '../types/ticketDetail'

/** Header/meta do ticket (B8). queryKey por ticketId para cache correto. */
export function useTicketDetail(ticketId: number) {
  return useQuery<TicketHeaderDto>({
    queryKey: ['ticket-detail', ticketId],
    queryFn: () => getTicketById(ticketId),
    enabled: Boolean(ticketId),
  })
}
