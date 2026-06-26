import { useQuery } from '@tanstack/react-query'
import { listTicketTimeEntries } from '../services/ticketDetailService'
import type { TicketTimeEntryDto } from '../types/ticketDetail'

/** Apontamentos do ticket (B2/B3). queryKey por ticketId. */
export function useTicketTimeEntries(ticketId: number) {
  return useQuery<TicketTimeEntryDto[]>({
    queryKey: ['ticket-time-entries', ticketId],
    queryFn: () => listTicketTimeEntries(ticketId),
    enabled: Boolean(ticketId),
  })
}
