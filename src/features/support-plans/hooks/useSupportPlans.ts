import { useQuery } from '@tanstack/react-query'
import {
  listCalendarOptions,
  listSupportPlans,
  listUnmatchedPlans,
} from '../services/supportPlansService'

/** Chave da lista de planos — `GET /api/v1/support-plans` (sem parâmetros). */
export const SUPPORT_PLANS_QUERY_KEY = ['support-plans'] as const

/** Chave do card de planos do HubSpot sem correspondência. */
export const UNMATCHED_PLANS_QUERY_KEY = ['support-plans', 'unmatched'] as const

/** Chave das opções de calendário (compartilhada com a tela de calendário, FE-F2F3). */
export const CALENDAR_OPTIONS_QUERY_KEY = ['calendars', 'options'] as const

export function useSupportPlans() {
  return useQuery({
    queryKey: SUPPORT_PLANS_QUERY_KEY,
    queryFn: () => listSupportPlans(),
  })
}

export function useUnmatchedPlans() {
  return useQuery({
    queryKey: UNMATCHED_PLANS_QUERY_KEY,
    queryFn: () => listUnmatchedPlans(),
  })
}

/**
 * Opções de calendário para o seletor "Calendário do plano".
 *
 * `GET /api/v1/calendars` é da unidade **BE-F2F3** (onda 2) e ainda não existe. O
 * consumo é deliberadamente **degradável**:
 * - `retry: false` — reentar um 404 de endpoint inexistente só atrasa a tela;
 * - o erro **não** derruba a tela de planos; o seletor fica desabilitado com dica, e o
 *   plano continua no "Calendário padrão" (`calendarioId: null`), que é o comportamento
 *   descrito no contrato (§3) e o único disponível enquanto não houver cadastro.
 *
 * A distinção "não sei responder" (erro) × "respondi que não há nada" (`[]`) é mantida
 * — AP-FRONTEND-021: os dois casos desabilitam o seletor, com **textos diferentes**.
 */
export function usePlanCalendars() {
  return useQuery({
    queryKey: CALENDAR_OPTIONS_QUERY_KEY,
    queryFn: () => listCalendarOptions(),
    retry: false,
  })
}
