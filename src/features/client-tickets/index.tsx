/**
 * F2 — Tela "Tickets do cliente" (/relatorios/clientes/$clientId).
 *
 * Drill-down de Consumo de Planos. Mostra:
 *  - KPIs do topo (plano/usado/restante/extras/faturável/%) da linha do cliente.
 *  - Tabela de tickets do cliente (reusa /reports/tickets?clientId=).
 * Linha → detalhe do ticket (/relatorios/tickets/$ticketId).
 *
 * Privacidade (R5): esta é a visão interna de drill-down, não o relatório/PDF do
 * cliente. Mostrar dados internos do ticket aqui é permitido.
 */

import { useCallback, useMemo, useRef, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { PageWrapper } from '../../components/layout/PageWrapper'
import { DataTable } from '../../components/ui/DataTable/DataTable'
import { Pagination } from '../../components/ui/Pagination'
import { Input } from '../../components/ui/Input'
import { EmptyState } from '../../components/ui/EmptyState'
import { ErrorState } from '../../components/ui/ErrorState'
import { Skeleton } from '../../components/ui/Skeleton'
import { KpiCard } from '../dashboards/shared/components/KpiCard'
import { KpiCardGrid } from '../dashboards/shared/components/KpiCardGrid'
import { formatClientName, formatHours, formatPercent } from '../reports/shared/utils/formatters'
import { getPercentClass } from '../reports/plan-consumption/columns'
import type { ClientTicketItemDto } from './types/clientTickets'
import { buildClientTicketsColumns } from './columns'
import { useClientTickets } from './hooks/useClientTickets'
import { useClientKpis } from './hooks/useClientKpis'

const TABLE_ID = 'client-tickets'

const PERCENT_SUBTEXT: Record<ReturnType<typeof getPercentClass>, 'positive' | 'negative' | 'neutral'> = {
  green: 'positive',
  yellow: 'neutral',
  red: 'negative',
  neutral: 'neutral',
}

type ClientTicketsPageProps = {
  clientId: number
}

export default function ClientTicketsPage({ clientId }: ClientTicketsPageProps) {
  const navigate = useNavigate()

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

  const handleRowClick = useCallback(
    (row: ClientTicketItemDto) => {
      void navigate({
        to: '/relatorios/tickets/$ticketId',
        params: { ticketId: String(row.ticketId) },
        search: { from: 'clientes', clientId: String(clientId) },
      })
    },
    [navigate, clientId],
  )

  const kpis = kpisQuery.data
  const clientName = kpis ? formatClientName(kpis) : 'Cliente'
  const pctClass = getPercentClass(kpis?.percentualPlano ?? null)

  const isEmpty = !isLoading && !isError && (!data || data.items.length === 0)

  return (
    <PageWrapper
      title={`Tickets — ${clientName}`}
      breadcrumbItems={[
        { label: 'Relatórios' },
        {
          label: 'Consumo de Planos',
          href: '/relatorios/consumo-planos',
        },
        { label: clientName },
      ]}
    >
      {/* KPIs do topo */}
      <section aria-label="Resumo do plano do cliente" className="mb-4">
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
      <div className="mb-4 p-4 bg-card rounded-[5px] border border-border">
        <div className="flex flex-wrap items-end gap-3">
          <Input
            label="Buscar"
            id="client-tickets-search"
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
            tableId={TABLE_ID}
            columns={columns}
            data={data?.items ?? []}
            sortState={{ sortBy, sortDirection }}
            onSort={setSort}
            onRowClick={handleRowClick}
            isClickable
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
    </PageWrapper>
  )
}
