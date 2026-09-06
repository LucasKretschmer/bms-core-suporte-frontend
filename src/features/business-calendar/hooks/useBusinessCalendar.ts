import { useQueries, useQuery } from '@tanstack/react-query'
import {
  getHolidayImpact,
  getSchedule,
  listCalendars,
  listHolidays,
  type ListHolidaysParams,
} from '../services/businessCalendarService'

/**
 * 124/F2+F3 — queries do calendário comercial.
 *
 * ## Chaves e por que estas
 *
 * | Chave | Query |
 * |---|---|
 * | `['calendars']` | lista de calendários (esta tela) |
 * | `['calendars', id, 'schedule']` | expediente de um calendário |
 * | `['calendars', id, 'holidays', params]` | página de feriados |
 * | `['calendars', id, 'holidays', 'impacto', data]` | pré-contagem de impacto de UMA data |
 * | `['calendars', 'options']` | **de `FE-F1`** — seletor de calendário da tela de planos (`features/support-plans/hooks/useSupportPlans.ts`) |
 *
 * O casamento do TanStack Query é por **prefixo**: invalidar `['calendars']` alcança as
 * quatro, inclusive a de `FE-F1`. É deliberado — criar um calendário aqui muda o que o
 * seletor da tela de planos oferece, e sem isso o gestor cadastraria o calendário e
 * continuaria sem vê-lo lá até um reload (o defeito corrigido em 123/FE-2 nas
 * categorias). A chave de `FE-F1` **não foi movida para cá**: `features/support-plans/`
 * está fora do escopo desta unidade.
 */

/** Lista de calendários — `GET /api/v1/calendars` (sem parâmetros). */
export const CALENDARS_QUERY_KEY = ['calendars'] as const

export function scheduleQueryKey(calendarId: number) {
  return ['calendars', calendarId, 'schedule'] as const
}

export function holidaysQueryKey(calendarId: number, params: ListHolidaysParams) {
  return ['calendars', calendarId, 'holidays', params] as const
}

export function useCalendars() {
  return useQuery({
    queryKey: CALENDARS_QUERY_KEY,
    queryFn: () => listCalendars(),
  })
}

/**
 * Expediente do calendário selecionado. `enabled` só quando há calendário — sem isso a
 * query dispararia com `null` na URL assim que a tela montasse, antes de qualquer
 * calendário existir (a tabela nasce **vazia**, D-5).
 */
export function useSchedule(calendarId: number | null) {
  return useQuery({
    queryKey: scheduleQueryKey(calendarId ?? 0),
    queryFn: () => getSchedule(calendarId as number),
    enabled: calendarId != null,
  })
}

export function useHolidays(calendarId: number | null, params: ListHolidaysParams) {
  return useQuery({
    queryKey: holidaysQueryKey(calendarId ?? 0, params),
    queryFn: () => listHolidays(calendarId as number, params),
    enabled: calendarId != null,
  })
}

export function holidayImpactQueryKey(calendarId: number, data: string) {
  return ['calendars', calendarId, 'holidays', 'impacto', data] as const
}

/**
 * **Pré-contagem de impacto de N datas** — o número que a confirmação de DD-2 exibe **antes**
 * de o usuário decidir.
 *
 * São N datas porque **editar tem duas**: a antiga e a nova. Mover um feriado de ontem para
 * amanhã mexe no passado tanto quanto o contrário, e cada dia tem a sua própria contagem.
 * `useQueries` é o que permite variar a quantidade sem quebrar a regra dos hooks.
 *
 * - Lista vazia ⇒ **nenhuma requisição** (é o caminho normal: data futura não consulta nada).
 * - `retry: false` — o diálogo está aberto esperando esta resposta; reentar um `422` só
 *   prolongaria a espera de algo que não vai mudar.
 * - A chave entra no prefixo `['calendars']`, então toda mutação de feriado invalida também
 *   as contagens — o número não pode envelhecer depois de a lista mudar.
 */
export function useHolidayImpacts(calendarId: number, datas: readonly string[]) {
  return useQueries({
    queries: datas.map((data) => ({
      queryKey: holidayImpactQueryKey(calendarId, data),
      queryFn: () => getHolidayImpact(calendarId, data),
      retry: false,
    })),
  })
}
