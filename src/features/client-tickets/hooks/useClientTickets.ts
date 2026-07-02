import { useCallback, useMemo } from 'react'
import { useServerTable } from '../../reports/shared/hooks/useServerTable'
import type { TableParams } from '../../reports/shared/hooks/useServerTable'
import { listClientTickets } from '../services/clientTicketsService'
import type { ClientTicketItemDto } from '../types/clientTickets'

export type ClientTicketsFilters = {
  search: string
  status: string[]
  teamId: number[]
  owner: number[]
  /** Período (YYYY-MM-DD, clearable). null = sem filtro de data. */
  from: string | null
  to: string | null
}

/** Datas iniciais para semear o período — pré-preenchimento vindo da origem (095). */
export type ClientTicketsInitial = {
  from?: string | null
  to?: string | null
}

function buildInitialFilters(initial?: ClientTicketsInitial): ClientTicketsFilters {
  return {
    search: '',
    status: [],
    teamId: [],
    owner: [],
    from: initial?.from ?? null,
    to: initial?.to ?? null,
  }
}

/**
 * Hook de tabela server-side para a tela "Tickets do cliente" (F2).
 * Sempre passa o clientId — a queryKey inclui clientId + filtros para cache correto.
 *
 * `initial` semeia o período na 1ª render (pré-preenchimento origem→destino, 095);
 * useServerTable só usa initialFilters na montagem — memoizar mantém a referência estável.
 */
export function useClientTickets(clientId: number, initial?: ClientTicketsInitial) {
  const queryFn = useCallback(
    (params: TableParams<ClientTicketsFilters>) =>
      listClientTickets({
        clientId,
        search: params.filters.search || undefined,
        status: params.filters.status.length > 0 ? params.filters.status : undefined,
        teamId: params.filters.teamId.length > 0 ? params.filters.teamId : undefined,
        owner: params.filters.owner.length > 0 ? params.filters.owner : undefined,
        from: params.filters.from ?? undefined,
        to: params.filters.to ?? undefined,
        sortBy: params.sortBy ?? undefined,
        sortDirection: params.sortDirection,
        page: params.page,
        pageSize: params.pageSize,
      }),
    [clientId],
  )

  const initialFilters = useMemo(
    () => buildInitialFilters(initial),
    // Semente usada só na 1ª render — reagir a mudanças de valor das datas iniciais.
    [initial?.from, initial?.to],
  )

  return useServerTable<ClientTicketsFilters, ClientTicketItemDto>({
    queryKey: `client-tickets:${clientId}`,
    queryFn,
    initialFilters,
    initialSortBy: null,
    initialSortDirection: 'desc',
    enabled: Boolean(clientId),
  })
}
