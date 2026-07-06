/**
 * U4 — Apontamentos por Ticket
 *
 * Lista todos os tickets com tempo agregado no período.
 * Inclui tickets com totalSeconds = 0 (sem apontamentos no período).
 * Acessível a todos os usuários autenticados (AtendentePlus).
 *
 * Linha clicável: navega para o detalhe interno do ticket (/relatorios/tickets/$ticketId).
 * O link do HubSpot continua disponível dentro da célula "Ticket" (stopPropagation).
 *
 * Export: CSV e Excel com as colunas mapeadas (nunca categoria do HubSpot).
 */

import { useCallback, useDeferredValue, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { ReportPageLayout } from '../../../components/layout/ReportPageLayout'
import { DataTable } from '../../../components/ui/DataTable/DataTable'
import { Pagination } from '../../../components/ui/Pagination'
import { Input } from '../../../components/ui/Input'
import { Combobox } from '../../../components/ui/Combobox'
import { MultiSelectCombobox } from '../../../components/ui/MultiSelectCombobox'
import type { MultiSelectOption } from '../../../components/ui/MultiSelectCombobox'
import { useToast } from '../../../components/ui/Toast'
import { ExportButtons } from '../shared/components/ExportButtons'
import { PeriodFilter } from '../shared/components/PeriodFilter'
import {
  getTicketCategories,
  getTicketStatuses,
  listTeams,
  listTicketsReport,
} from '../shared/services/reportsService'
import { formatSeconds } from '../shared/utils/formatters'
import { exportToCsv, exportToXlsx } from '../shared/utils/exportTable'
import type { ExportColumn, ExportRow } from '../shared/utils/exportTable'
import { fetchAllPaginated, ExportLimitError } from '../shared/utils/fetchAllPaginated'
import { usePermissions } from '../../../hooks/usePermissions'
import { saveReportFilters } from '../../../utils/reportFilters'
import { useAppointments } from './hooks/useAppointments'
import { buildAppointmentsColumns } from './columns'
import type { TicketReportItemDto } from '../shared/types/reports'

/** Chave de persistência de filtros desta tela (R2) */
const FILTERS_KEY = 'appointments'

// ── Opções de scope ──────────────────────────────────────────────────────────

const SCOPE_OPTIONS = [
  { value: 'mine', label: 'Meus tickets' },
  { value: 'team', label: 'Minha equipe' },
  { value: 'all', label: 'Todos' },
]

// ── Colunas para export (mapeamento de campos simples, sem JSX) ──────────────

// Exportado para teste (107): garante que a categoria HubSpot NUNCA entra no
// arquivo exportável desta tela (privacidade — só aparece na tela).
export const EXPORT_COLUMNS: ExportColumn[] = [
  { header: 'Ticket', key: 'ticket' },
  { header: 'Assunto', key: 'assunto' },
  { header: 'Cliente', key: 'cliente' },
  { header: 'Equipe', key: 'equipe' },
  { header: 'Atendente', key: 'owner' },
  { header: 'Status', key: 'status' },
  { header: 'Tempo', key: 'tempo' },
  { header: 'Apontamentos', key: 'apontamentos' },
]

export function mapToExportRow(item: TicketReportItemDto): ExportRow {
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
  const navigate = useNavigate()
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

  // Opções dos filtros multi-select (Status e Equipes).
  // Loading/erro do fetch não quebram a tela — o controle apenas fica vazio/desabilitado.
  const statusesQuery = useQuery({
    queryKey: ['ticket-statuses'],
    queryFn: getTicketStatuses,
    staleTime: 5 * 60 * 1000,
  })
  const teamsQuery = useQuery({
    queryKey: ['teams'],
    queryFn: listTeams,
    staleTime: 5 * 60 * 1000,
  })
  // Opções de categoria HubSpot (107). Falha/loading não quebram a tela.
  const categoriesQuery = useQuery({
    queryKey: ['ticket-categories'],
    queryFn: getTicketCategories,
    staleTime: 5 * 60 * 1000,
  })

  const statusOptions = useMemo<MultiSelectOption<string>[]>(
    () => (statusesQuery.data ?? []).map((s) => ({ value: s.value, label: s.label })),
    [statusesQuery.data],
  )
  const teamOptions = useMemo<MultiSelectOption<number>[]>(
    () => (teamsQuery.data ?? []).map((t) => ({ value: t.id, label: t.nome })),
    [teamsQuery.data],
  )
  const categoriaOptions = useMemo<MultiSelectOption<string>[]>(
    () => (categoriesQuery.data ?? []).map((c) => ({ value: c.value, label: c.label })),
    [categoriesQuery.data],
  )

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

  // Navegação por linha: detalhe interno do ticket (por id interno).
  // O link externo do HubSpot continua na célula "Ticket" (stopPropagation).
  const handleRowClick = useCallback(
    (row: TicketReportItemDto) => {
      saveReportFilters(FILTERS_KEY, { ...filters, sortBy, sortDirection })
      void navigate({
        to: '/relatorios/tickets/$ticketId',
        params: { ticketId: String(row.ticketId) },
        search: { from: 'apontamentos' },
      })
    },
    [navigate, filters, sortBy, sortDirection],
  )

  const sortState = useDeferredValue({ sortBy, sortDirection })

  const isEmpty = !isLoading && !isError && (!data || data.items.length === 0)

  // ── Export ──────────────────────────────────────────────────────────────────

  function fetchAllForExport(): Promise<TicketReportItemDto[]> {
    return fetchAllPaginated<TicketReportItemDto>((page, pageSize) =>
      listTicketsReport({
        scope: filters.scope,
        search: filters.search || undefined,
        status: filters.status.length > 0 ? filters.status : undefined,
        teamId: filters.teamId.length > 0 ? filters.teamId : undefined,
        categoria: filters.categoria.length > 0 ? filters.categoria : undefined,
        from: filters.from ?? undefined,
        to: filters.to ?? undefined,
        sortBy: sortBy ?? undefined,
        sortDirection,
        page,
        pageSize,
      }),
    )
  }

  async function handleExportCsv() {
    if (isExporting) return
    setIsExporting(true)
    toast.info('Carregando dados para exportar…')
    try {
      const items = await fetchAllForExport()
      exportToCsv('apontamentos-por-ticket', EXPORT_COLUMNS, items.map(mapToExportRow))
      toast.success('Exportação CSV concluída.')
    } catch (err) {
      toast.error(
        err instanceof ExportLimitError ? err.message : 'Erro ao exportar. Tente novamente.',
      )
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
    } catch (err) {
      toast.error(
        err instanceof ExportLimitError ? err.message : 'Erro ao exportar. Tente novamente.',
      )
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

      {/* Filtro de Status (multi-select com checkboxes) */}
      <MultiSelectCombobox<string>
        id="appointments-status"
        label="Status"
        summaryLabel="Status"
        value={filters.status}
        options={statusOptions}
        onChange={(status) => setFilters({ status })}
        placeholder="Todos"
        searchable
        isLoading={statusesQuery.isLoading}
        error={statusesQuery.isError ? 'Falha ao carregar status.' : undefined}
        className="min-w-[281px]"
      />

      {/* Filtro de Equipes (multi-select com checkboxes) */}
      <MultiSelectCombobox<number>
        id="appointments-teams"
        label="Equipes"
        summaryLabel="Equipes"
        value={filters.teamId}
        options={teamOptions}
        onChange={(teamId) => setFilters({ teamId })}
        placeholder="Todas"
        searchable
        isLoading={teamsQuery.isLoading}
        error={teamsQuery.isError ? 'Falha ao carregar equipes.' : undefined}
        className="min-w-[180px]"
      />

      {/* Filtro de Categoria HubSpot (107) — só na tela, nunca no export */}
      <MultiSelectCombobox<string>
        id="appointments-categoria"
        label="Categoria"
        summaryLabel="Categoria"
        value={filters.categoria}
        options={categoriaOptions}
        onChange={(categoria) => setFilters({ categoria })}
        placeholder="Todas"
        searchable
        isLoading={categoriesQuery.isLoading}
        error={categoriesQuery.isError ? 'Falha ao carregar categorias.' : undefined}
        className="min-w-[220px]"
      />

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
