/**
 * ClientTicketsPanel — conteúdo reutilizável de "Tickets do cliente".
 *
 * Extraído de client-tickets/index.tsx para ser usado em dois contextos:
 *  - Página dedicada /relatorios/clientes/$clientId (dentro de PageWrapper).
 *  - Drawer inline na tela de Consumo de Planos (FE-5 / #11).
 *
 * Contém KPIs do topo + busca + tabela + paginação + os 3 estados de UI.
 * Sem PageWrapper/breadcrumb — quem renderiza decide o envoltório.
 *
 * listClientTickets já passa scope='all' por default (CoordenadorPlus) — nada a
 * configurar aqui. Privacidade (R5): visão interna de drill-down.
 */

import { useMemo, useRef, useState } from 'react'
import { DataTable } from '../../../components/ui/DataTable/DataTable'
import { Pagination } from '../../../components/ui/Pagination'
import { Input } from '../../../components/ui/Input'
import { EmptyState } from '../../../components/ui/EmptyState'
import { ErrorState } from '../../../components/ui/ErrorState'
import { Skeleton } from '../../../components/ui/Skeleton'
import { KpiCard } from '../../dashboards/shared/components/KpiCard'
import { KpiCardGrid } from '../../dashboards/shared/components/KpiCardGrid'
import { formatHours, formatPercent } from '../../reports/shared/utils/formatters'
import { getPercentClass } from '../../reports/plan-consumption/columns'
import type { ClientTicketItemDto } from '../types/clientTickets'
import { buildClientTicketsColumns } from '../columns'
import { useClientTickets } from '../hooks/useClientTickets'
import { useClientKpis } from '../hooks/useClientKpis'

const PERCENT_SUBTEXT: Record<
  ReturnType<typeof getPercentClass>,
  'positive' | 'negative' | 'neutral'
> = {
  green: 'positive',
  yellow: 'neutral',
  red: 'negative',
  neutral: 'neutral',
}

type ClientTicketsPanelProps = {
  clientId: number
  /** Id único da tabela (persistência de ordem de colunas). */
  tableId?: string
  /** Callback ao clicar numa linha de ticket (ex.: navegar ao detalhe). */
  onTicketClick?: (row: ClientTicketItemDto) => void
}

export function ClientTicketsPanel({
  clientId,
  tableId = 'client-tickets',
  onTicketClick,
}: ClientTicketsPanelProps) {
  const kpisQuery = useClientKpis(clientId)
  const {
    data,
    isLoading,
    isError,
    refetch,
    sortBy,
    sortDirection,
    filters,
    setPage,
    setPageSize,
    setSort,
    setFilters,
  } = useClientTickets(clientId)

  // Busca textual com debounce
  const [searchInput, setSearchInput] = useState(filters.search)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  function handleSearchChange(value: string) {
    setSearchInput(value)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => setFilters({ search: value }), 300)
  }

  const columns = useMemo(() => buildClientTicketsColumns(), [])

  const kpis = kpisQuery.data
  const pctClass = getPercentClass(kpis?.percentualPlano ?? null)

  const isEmpty = !isLoading && !isError && (!data || data.items.length === 0)

  return (
    <div className="flex flex-col gap-4">
      {/* KPIs do topo */}
      <section aria-label="Resumo do plano do cliente">
        <KpiCardGrid>
          <KpiCard
            label="Plano"
            value={kpis?.nomePlano ?? '—'}
            isLoading={kpisQuery.isLoading}
          />
          <KpiCard
            label="Horas usadas"
            value={kpis ? formatHours(kpis.horasUsadas) : '—'}
            isLoading={kpisQuery.isLoading}
          />
          <KpiCard
            label="Horas restantes"
            value={kpis ? formatHours(kpis.horasRestantes) : '—'}
            isLoading={kpisQuery.isLoading}
          />
          <KpiCard
            label="Extras (estouro)"
            value={kpis ? formatHours(kpis.horasAdicionais) : '—'}
            isLoading={kpisQuery.isLoading}
            tooltipText="Horas consumidas além do plano contratado."
          />
          <KpiCard
            label="Faturável por fora"
            value={kpis ? formatHours(kpis.horasFaturaveis) : '—'}
            isLoading={kpisQuery.isLoading}
          />
          <KpiCard
            label="% do plano"
            value={formatPercent(kpis?.percentualPlano ?? null)}
            subtext={kpis ? undefined : 'Cliente sem plano no período'}
            subtextVariant={PERCENT_SUBTEXT[pctClass]}
            isLoading={kpisQuery.isLoading}
          />
        </KpiCardGrid>
      </section>

      {/* Filtros */}
      <div className="p-4 bg-card rounded-[5px] border border-border">
        <div className="flex flex-wrap items-end gap-3">
          <Input
            label="Buscar"
            id={`${tableId}-search`}
            type="text"
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Ticket, assunto, atendente…"
            className="min-w-[220px]"
          />
        </div>
      </div>

      {/* Estados de UI */}
      {isLoading && (
        <div className="bg-card rounded-[5px] border border-border p-6">
          <Skeleton lines={8} />
        </div>
      )}
      {!isLoading && isError && <ErrorState onRetry={() => void refetch()} />}
      {!isLoading && !isError && isEmpty && (
        <EmptyState message="Nenhum ticket encontrado para este cliente no período." />
      )}
      {!isLoading && !isError && !isEmpty && (
        <div className="bg-card rounded-[5px] border border-border overflow-hidden">
          <DataTable<ClientTicketItemDto>
            tableId={tableId}
            columns={columns}
            data={data?.items ?? []}
            sortState={{ sortBy, sortDirection }}
            onSort={setSort}
            onRowClick={onTicketClick}
            isClickable={Boolean(onTicketClick)}
          />
          {data && (
            <div className="px-5 border-t border-border">
              <Pagination
                page={data.page}
                pageSize={data.pageSize}
                totalCount={data.totalCount}
                totalPages={data.totalPages}
                pageSizeOptions={[25, 50, 100, 200]}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
