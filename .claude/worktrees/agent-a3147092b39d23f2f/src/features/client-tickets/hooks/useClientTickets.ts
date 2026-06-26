import { useCallback } from 'react'
import { useServerTable } from '../../reports/shared/hooks/useServerTable'
import type { TableParams } from '../../reports/shared/hooks/useServerTable'
import { listClientTickets } from '../services/clientTicketsService'
import type { ClientTicketItemDto } from '../types/clientTickets'

export type ClientTicketsFilters = {
  search: string
  status: string[]
}

const INITIAL_FILTERS: ClientTicketsFilters = {
  search: '',
  status: [],
}

/**
 * Hook de tabela server-side para a tela "Tickets do cliente" (F2).
 * Sempre passa o clientId — a queryKey inclui clientId + filtros para cache correto.
 */
export function useClientTickets(clientId: number) {
  const queryFn = useCallback(
    (params: TableParams<ClientTicketsFilters>) =>
      listClientTickets({
        clientId,
        search: params.filters.search || undefined,
        status: params.filters.status.length > 0 ? params.filters.status : undefined,
        sortBy: params.sortBy ?? undefined,
        sortDirection: params.sortDirection,
        page: params.page,
        pageSize: params.pageSize,
      }),
    [clientId],
  )

  return useServerTable<ClientTicketsFilters, ClientTicketItemDto>({
    queryKey: `client-tickets:${clientId}`,
    queryFn,
    initialFilters: INITIAL_FILTERS,
    initialSortBy: null,
    initialSortDirection: 'desc',
    enabled: Boolean(clientId),
  })
}
