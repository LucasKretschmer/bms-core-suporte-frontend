/**
 * U4 — Apontamentos por Ticket
 *
 * Lista todos os tickets com tempo agregado no período.
 * Inclui tickets com totalSeconds = 0 (sem apontamentos no período).
 * Acessível a todos os usuários autenticados (AtendentePlus).
 *
 * Linha clicável: abre o ticket no HubSpot em nova aba (rel="noopener noreferrer").
 * TODO: quando existir rota de logs do ticket (/relatorios/tickets/:id), navegar para ela.
 *
 * Export: CSV e Excel com as colunas mapeadas (nunca categoria do HubSpot).
 */

import { useCallback, useDeferredValue, useMemo, useRef, useState } from 'react'
import { ReportPageLayout } from '../../../components/layout/ReportPageLayout'
import { DataTable } from '../../../components/ui/DataTable/DataTable'
import { Pagination } from '../../../components/ui/Pagination'
import { Input } from '../../../components/ui/Input'
import { Combobox } from '../../../components/ui/Combobox'
import { useToast } from '../../../components/ui/Toast'
import { ExportButtons } from '../shared/components/ExportButtons'
import { PeriodFilter } from '../shared/components/PeriodFilter'
import { listTicketsReport } from '../shared/services/reportsService'
import { formatSeconds } from '../shared/utils/formatters'
import { exportToCsv, exportToXlsx } from '../shared/utils/exportTable'
import type { ExportColumn, ExportRow } from '../shared/utils/exportTable'
import { usePermissions } from '../../../hooks/usePermissions'
import { useAppointments } from './hooks/useAppointments'
import { buildAppointmentsColumns } from './columns'
import type { TicketReportItemDto } from '../shared/types/reports'

// ── Opções de scope ──────────────────────────────────────────────────────────

const SCOPE_OPTIONS = [
  { value: 'mine', label: 'Meus tickets' },
  { value: 'team', label: 'Minha equipe' },
  { value: 'all', label: 'Todos' },
]

// ── Colunas para export (mapeamento de campos simples, sem JSX) ──────────────

const EXPORT_COLUMNS: ExportColumn[] = [
  { header: 'Ticket', key: 'ticket' },
  { header: 'Assunto', key: 'assunto' },
  { header: 'Cliente', key: 'cliente' },
  { header: 'Equipe', key: 'equipe' },
  { header: 'Atendente', key: 'owner' },
  { header: 'Status', key: 'status' },
  { header: 'Tempo', key: 'tempo' },
  { header: 'Apontamentos', key: 'apontamentos' },
]

function mapToExportRow(item: TicketReportItemDto): ExportRow {
  return {
    ticket: `#${item.hubspotTicketId}`,
    assunto: item.assunto ?? '',
    cliente: item.clienteNome ?? '',
    equipe: item.equipe ?? '',
    owner: item.ownerNome ?? '',
    status: item.status ?? '',
    tempo: formatSeconds(item.totalSeconds),
    apontamentos: item.apontamentosCount,
  }
}

// ── Componente principal ─────────────────────────────────────────────────────

export default function AppointmentsPage() {
  const { isCoordenadorOuAcima } = usePermissions()
  const toast = useToast()
  const [isExporting, setIsExporting] = useState(false)

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
  } = useAppointments()

  // Busca textual com debounce via useDeferredValue
  const [searchInput, setSearchInput] = useState(filters.search)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleSearchChange(value: string) {
    setSearchInput(value)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => {
      setFilters({ search: value })
    }, 300)
  }

  // Colunas com memoize — reconstrução apenas se necessário
  const columns = useMemo(() => buildAppointmentsColumns(), [])

  // Navegação por linha: abre HubSpot em nova aba
  // TODO: quando existir rota /relatorios/tickets/:id, navegar para ela primeiro
  const handleRowClick = useCallback((row: TicketReportItemDto) => {
    if (row.hubspotUrl) {
      window.open(row.hubspotUrl, '_blank', 'noopener,noreferrer')
    }
  }, [])

  const sortState = useDeferredValue({ sortBy, sortDirection })

  const isEmpty = !isLoading && !isError && (!data || data.items.length === 0)

  // ── Export ──────────────────────────────────────────────────────────────────

  async function fetchAllForExport(): Promise<TicketReportItemDto[]> {
    const PAGE_SIZE = 200
    const firstPage = await listTicketsReport({
      scope: filters.scope,
      search: filters.search || undefined,
      status: filters.status.length > 0 ? filters.status : undefined,
      from: filters.from ?? undefined,
      to: filters.to ?? undefined,
      sortBy: sortBy ?? undefined,
      sortDirection,
      page: 1,
      pageSize: PAGE_SIZE,
    })

    const allItems = [...firstPage.items]
    const totalPages = firstPage.totalPages

    for (let p = 2; p <= totalPages; p++) {
      const next = await listTicketsReport({
        scope: filters.scope,
        search: filters.search || undefined,
        status: filters.status.length > 0 ? filters.status : undefined,
        from: filters.from ?? undefined,
        to: filters.to ?? undefined,
        sortBy: sortBy ?? undefined,
        sortDirection,
        page: p,
        pageSize: PAGE_SIZE,
      })
      allItems.push(...next.items)
    }

    return allItems
  }

  async function handleExportCsv() {
    if (isExporting) return
    setIsExporting(true)
    toast.info('Carregando dados para exportar…')
    try {
      const items = await fetchAllForExport()
      exportToCsv('apontamentos-por-ticket', EXPORT_COLUMNS, items.map(mapToExportRow))
      toast.success('Exportação CSV concluída.')
    } catch {
      toast.error('Erro ao exportar. Tente novamente.')
    } finally {
      setIsExporting(false)
    }
  }

  async function handleExportXlsx() {
    if (isExporting) return
    setIsExporting(true)
    toast.info('Carregando dados para exportar…')
    try {
      const items = await fetchAllForExport()
      await exportToXlsx('apontamentos-por-ticket', EXPORT_COLUMNS, items.map(mapToExportRow))
      toast.success('Exportação Excel concluída.')
    } catch {
      toast.error('Erro ao exportar. Tente novamente.')
    } finally {
      setIsExporting(false)
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  const filters_ui = (
    <div className="flex flex-wrap items-end gap-3">
      {/* Busca global */}
      <Input
        label="Buscar"
        id="appointments-search"
        type="text"
        value={searchInput}
        onChange={(e) => handleSearchChange(e.target.value)}
        placeholder="Ticket, assunto, cliente…"
        className="min-w-[220px]"
      />

      {/* Seletor de scope — apenas para CoordenadorPlus */}
      {isCoordenadorOuAcima && (
        <Combobox
          label="Escopo"
          id="appointments-scope"
          value={filters.scope}
          options={SCOPE_OPTIONS}
          onChange={(v) => setFilters({ scope: v as 'mine' | 'team' | 'all' })}
          placeholder="Selecione…"
          className="min-w-[160px]"
        />
      )}

      {/* Período */}
      <PeriodFilter
        from={filters.from}
        to={filters.to}
        onChange={(from, to) => setFilters({ from, to })}
      />
    </div>
  )

  const export_actions = (
    <ExportButtons
      onExportCsv={() => void handleExportCsv()}
      onExportXlsx={() => void handleExportXlsx()}
      isExporting={isExporting}
    />
  )

  return (
    <ReportPageLayout
      title="Apontamentos por Ticket"
      breadcrumbItems={[
        { label: 'Relatórios' },
        { label: 'Apontamentos por Ticket' },
      ]}
      filters={filters_ui}
      exportActions={export_actions}
      isLoading={isLoading}
      isError={isError}
      isEmpty={isEmpty}
      onRetry={() => void refetch()}
      emptyMessage="Nenhum ticket encontrado para os filtros selecionados."
    >
      <DataTable<TicketReportItemDto>
        tableId="appointments"
        columns={columns}
        data={data?.items ?? []}
        sortState={sortState}
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
    </ReportPageLayout>
  )
}
