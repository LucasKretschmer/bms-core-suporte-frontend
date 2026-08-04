import { useQuery } from '@tanstack/react-query'
import { getClientKpis, type ClientKpisPeriod } from '../services/clientTicketsService'
import type { ClientKpis } from '../types/clientTickets'

/**
 * Busca os KPIs (consumo de plano) do cliente para o topo da tela "Tickets do cliente".
 *
 * `period` é obrigatório: os KPIs precisam do MESMO recorte de data da tabela de
 * chamados (121/C1). O período entra na `queryKey` — sem isso o TanStack Query
 * devolveria o resultado cacheado do período anterior e o bug voltaria em forma de
 * cache. `{ from: null, to: null }` é o ramo explícito "sem filtro" (o backend aplica
 * o default "mês corrente").
 *
 * Retorna null se o cliente não tiver linha no relatório de consumo daquele período
 * (cliente sem plano / sem consumo na janela) — a UI trata como KPIs "—".
 */
export function useClientKpis(clientId: number, period: ClientKpisPeriod) {
  return useQuery<ClientKpis | null>({
    queryKey: ['client-kpis', clientId, period.from, period.to],
    queryFn: () => getClientKpis(clientId, period),
    enabled: Boolean(clientId),
  })
}
