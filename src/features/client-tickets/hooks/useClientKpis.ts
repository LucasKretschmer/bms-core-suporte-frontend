import { useQuery } from '@tanstack/react-query'
import { getClientKpis } from '../services/clientTicketsService'
import type { ClientKpis } from '../types/clientTickets'

/**
 * Busca os KPIs (consumo de plano) do cliente para o topo da tela "Tickets do cliente".
 * queryKey inclui clientId para cache correto. Retorna null se o cliente não tiver linha
 * no relatório de consumo (cliente sem plano) — a UI trata como KPIs "—".
 */
export function useClientKpis(clientId: string) {
  return useQuery<ClientKpis | null>({
    queryKey: ['client-kpis', clientId],
    queryFn: () => getClientKpis(clientId),
    enabled: Boolean(clientId),
  })
}
