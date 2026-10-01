import { useCallback, useMemo } from 'react'
import { useServerTable } from '../../shared/hooks/useServerTable'
import { listTicketsReport } from '../../shared/services/reportsService'
import { usePermissions } from '../../../../hooks/usePermissions'
import { defaultTicketScope, type TicketScope } from '../../../../utils/reportScope'
import { defaultCurrentMonthPeriod } from '../../shared/utils/defaultPeriod'
import { loadReportFilters } from '../../../../utils/reportFilters'
import { buildTicketsReportParams } from '../ticketsReportParams'
import type { TableParams } from '../../shared/hooks/useServerTable'
import type { TicketReportItemDto } from '../../shared/types/reports'

export type AppointmentsFilters = {
  scope: TicketScope
  search: string
  status: string[]
  teamId: number[]
  /** Categorias HubSpot selecionadas no filtro (107). Vazio = sem filtro de categoria. */
  categoria: string[]
  /** MELH-02 — categorias do TIMER (internas) selecionadas. Vazio = sem filtro. */
  serviceCategoryId: number[]
  /** Toggle "Incluir chamados sem apontamento no período". false = envia somenteComApontamento=true. */
  incluirSemApontamento: boolean
  from: string | null
  to: string | null
}

/** Chave de persistência de filtros desta tela (R2) — casa com index.tsx. */
const FILTERS_KEY = 'appointments'

/**
 * Blob salvo em sessionStorage antes do drill-down (075): filtros + estado de
 * ordenação da tabela. Tolerante a formatos ausentes/parciais — `loadReportFilters`
 * mescla sobre o fallback, então todos os campos são opcionais.
 */
type AppointmentsSavedState = Partial<
  AppointmentsFilters & {
    sortBy: string | null
    sortDirection: 'asc' | 'desc'
  }
>

/**
 * Período default: do 1º dia do mês corrente até hoje (formato YYYY-MM-DD).
 *
 * Mantido como wrapper fino sobre o helper compartilhado `defaultCurrentMonthPeriod`
 * (053) — preserva a assinatura/comportamento da 052 e o ponto de import existente.
 */
export function defaultAppointmentsPeriod(reference: Date = new Date()): {
  from: string
  to: string
} {
  return defaultCurrentMonthPeriod(reference)
}

/**
 * Hook de tabela server-side para U4 — Apontamentos por Ticket.
 * Gerencia paginação, ordenação e filtros para GET /api/v1/reports/tickets.
 * Por padrão lista só chamados com apontamento no período ou em andamento; o toggle
 * `incluirSemApontamento` devolve os demais.
 *
 * Scope default por papel (#9): Coordenador+ → 'all'; Atendente → 'mine'.
 * UX apenas — o backend força 'mine' p/ Atendente (A01), é a fonte de verdade.
 */
export function useAppointments() {
  const { isCoordenadorOuAcima } = usePermissions()

  // Restaura o estado salvo no drill-down (075): ao voltar pela migalha, reidrata
  // filtros + ordenação de sessionStorage. Sem nada salvo, usa os defaults (053).
  // Memoizado por papel: useServerTable só usa os valores iniciais na 1ª render,
  // mas mantemos referência estável para evitar reset acidental.
  const { initialFilters, initialSortBy, initialSortDirection } = useMemo(() => {
    const period = defaultCurrentMonthPeriod()
    const defaults: AppointmentsFilters = {
      scope: defaultTicketScope(isCoordenadorOuAcima),
      search: '',
      status: [],
      teamId: [],
      categoria: [],
      serviceCategoryId: [],
      incluirSemApontamento: false,
      from: period.from,
      to: period.to,
    }

    // fallback: campos ausentes no blob são mesclados a partir dos defaults por
    // loadReportFilters, então o `saved` já vem completo quando havia algo salvo.
    // `from`/`to` são nuláveis (período clearable, 052) — preservar `null` salvo
    // (usuário limpou o período de propósito) usando os valores mesclados direto,
    // sem `?? defaults` que reverteria um `null` intencional ao mês atual.
    const saved = loadReportFilters<AppointmentsSavedState>(FILTERS_KEY, {
      ...defaults,
      sortBy: null,
      sortDirection: 'desc',
    })

    const restoredFilters: AppointmentsFilters = {
      scope: saved.scope ?? defaults.scope,
      search: saved.search ?? defaults.search,
      status: saved.status ?? defaults.status,
      teamId: saved.teamId ?? defaults.teamId,
      categoria: saved.categoria ?? defaults.categoria,
      serviceCategoryId: saved.serviceCategoryId ?? defaults.serviceCategoryId,
      incluirSemApontamento: saved.incluirSemApontamento ?? defaults.incluirSemApontamento,
      from: saved.from !== undefined ? saved.from : defaults.from,
      to: saved.to !== undefined ? saved.to : defaults.to,
    }

    return {
      initialFilters: restoredFilters,
      initialSortBy: saved.sortBy ?? null,
      initialSortDirection: saved.sortDirection ?? 'desc',
    }
  }, [isCoordenadorOuAcima])

  const queryFn = useCallback(
    (params: TableParams<AppointmentsFilters>) =>
      listTicketsReport(buildTicketsReportParams(params.filters, params, params)),
    [],
  )

  return useServerTable<AppointmentsFilters, TicketReportItemDto>({
    queryKey: 'tickets-report',
    queryFn,
    initialFilters,
    initialSortBy,
    initialSortDirection,
    enabled: true,
  })
}
