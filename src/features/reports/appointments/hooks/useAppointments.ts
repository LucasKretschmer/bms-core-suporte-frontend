import { useCallback, useMemo } from 'react'
import { useServerTable } from '../../shared/hooks/useServerTable'
import { listTicketsReport } from '../../shared/services/reportsService'
import { usePermissions } from '../../../../hooks/usePermissions'
import { defaultTicketScope, type TicketScope } from '../../../../utils/reportScope'
import { defaultCurrentMonthPeriod } from '../../shared/utils/defaultPeriod'
import { loadReportFilters } from '../../../../utils/reportFilters'
import type { TableParams } from '../../shared/hooks/useServerTable'
import type { TicketReportItemDto } from '../../shared/types/reports'

export type AppointmentsFilters = {
  scope: TicketScope
  search: string
  status: string[]
  teamId: number[]
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
 * Inclui todos os tickets — inclusive com totalSeconds = 0.
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
      listTicketsReport({
        scope: params.filters.scope,
        search: params.filters.search || undefined,
        status: params.filters.status.length > 0 ? params.filters.status : undefined,
        teamId: params.filters.teamId.length > 0 ? params.filters.teamId : undefined,
        from: params.filters.from ?? undefined,
        to: params.filters.to ?? undefined,
        sortBy: params.sortBy ?? undefined,
        sortDirection: params.sortDirection,
        page: params.page,
        pageSize: params.pageSize,
      }),
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
