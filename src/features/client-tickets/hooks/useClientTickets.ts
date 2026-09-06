import { useCallback, useMemo } from 'react'
import { useServerTable } from '../../reports/shared/hooks/useServerTable'
import type { TableParams } from '../../reports/shared/hooks/useServerTable'
import { resolverPeriodoPadrao } from '../../reports/shared/utils/periodoPadrao'
import { listClientTickets } from '../services/clientTicketsService'
import type { ClientTicketItemDto } from '../types/clientTickets'

export type ClientTicketsFilters = {
  search: string
  status: string[]
  teamId: number[]
  owner: number[]
  /**
   * Período (YYYY-MM-DD, clearable) — o que o usuário VÊ nos campos De/Até.
   *
   * 123/FE-PER (D-2): `null` aqui significa "campo em branco", **não** "sem filtro". A
   * janela que vai ao wire é sempre a de `resolverPeriodoPadrao`, que fecha a ponta em
   * branco no mês atual. Manter o `null` no estado é o que permite o campo continuar
   * limpável e a tela dizer "esta ponta ficou em branco, então vale o mês atual".
   */
  from: string | null
  to: string | null
  /**
   * 123/FAT-1 — visão "só o que entra na fatura do período" (`apenasFatura` de
   * `/reports/tickets`). Nasce `false`: o padrão da tela é a visão de CONFERÊNCIA, que
   * mostra também os chamados ainda em aberto — instrução explícita do usuário no
   * documento de QA da 121. Ligar por padrão mudaria o conjunto de linhas sem decisão
   * de produto (DP-7).
   */
  apenasFatura: boolean
}

/** Datas iniciais para semear o período — pré-preenchimento vindo da origem (095). */
export type ClientTicketsInitial = {
  from?: string | null
  to?: string | null
}

/**
 * 123/FE-PER (D-2) — o filtro NASCE no mês atual quando a origem não manda período.
 *
 * Decisão do usuário: *"Mantenha sempre o filtro do mês atual por padrão, se o usuário
 * quiser trocar ele troca."* Semear aqui (e não só resolver no wire) é o que faz os campos
 * De/Até **mostrarem** as datas em uso — a tela diz o que está exibindo em vez de aplicar um
 * default calado, que foi o defeito relatado.
 */
function buildInitialFilters(initial?: ClientTicketsInitial): ClientTicketsFilters {
  const periodo = resolverPeriodoPadrao({
    from: initial?.from ?? null,
    to: initial?.to ?? null,
  })
  return {
    search: '',
    status: [],
    teamId: [],
    owner: [],
    from: periodo.from,
    to: periodo.to,
    apenasFatura: false,
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
  const queryFn = useCallback((params: TableParams<ClientTicketsFilters>) => {
    const periodo = resolverPeriodoPadrao({
      from: params.filters.from,
      to: params.filters.to,
    })
    return listClientTickets({
      clientId,
      search: params.filters.search || undefined,
      status: params.filters.status.length > 0 ? params.filters.status : undefined,
      teamId: params.filters.teamId.length > 0 ? params.filters.teamId : undefined,
      owner: params.filters.owner.length > 0 ? params.filters.owner : undefined,
      // 123/FE-PER (D-2): a MESMA janela dos KPIs, sempre explícita no wire. Se fosse
      // `?? undefined`, limpar o campo devolveria `/reports/tickets` ao seu default de
      // range aberto (sem restrição) enquanto os KPIs cairiam no mês corrente do
      // `/metrics/plan-consumption` — as duas janelas na mesma tela, que é a D-2.
      from: periodo.from,
      to: periodo.to,
      // Só vai ao wire quando ligado — `false` é o default do controller.
      apenasFatura: params.filters.apenasFatura || undefined,
      sortBy: params.sortBy ?? undefined,
      sortDirection: params.sortDirection,
      page: params.page,
      pageSize: params.pageSize,
    })
  }, [clientId])

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
