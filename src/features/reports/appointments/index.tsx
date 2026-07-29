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

import { useCallback, useDeferredValue, useId, useMemo, useRef, useState } from 'react'
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
  listServiceCategoryOptions,
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
import { STATUS_LEGEND_ITEMS } from './statusColors'
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
// arquivo exportável desta tela (privacidade — só aparece na tela). D7 (119):
// "Tempo total"/"Categoria do atendimento" entram (dado interno de gestão).
export const EXPORT_COLUMNS: ExportColumn[] = [
  { header: 'Ticket', key: 'ticket' },
  { header: 'Assunto', key: 'assunto' },
  { header: 'Cliente', key: 'cliente' },
  { header: 'Equipe', key: 'equipe' },
  { header: 'Atendente', key: 'owner' },
  { header: 'Categoria do atendimento', key: 'categoriaAtendimento' },
  { header: 'Status', key: 'status' },
  { header: 'Tempo (período)', key: 'tempo' },
  { header: 'Tempo total', key: 'tempoTotal' },
  { header: 'Apontamentos (período)', key: 'apontamentos' },
  { header: 'Apontamentos (total)', key: 'apontamentosTotal' },
]

export function mapToExportRow(item: TicketReportItemDto): ExportRow {
  return {
    ticket: `#${item.hubspotTicketId}`,
    assunto: item.assunto ?? '',
    cliente: item.clienteNome?.trim() || '',
    equipe: item.equipe ?? '',
    owner: item.ownerNome ?? '',
    categoriaAtendimento: item.categoriasTimer.join('; '),
    status: item.status ?? '',
    tempo: formatSeconds(item.totalSeconds),
    tempoTotal: formatSeconds(item.totalSecondsAllTime),
    apontamentos: item.apontamentosCount,
    apontamentosTotal: item.apontamentosCountAllTime,
  }
}

// ── Legenda de status (MELH-01/D5) ────────────────────────────────────────────

/**
 * Legenda fixa das categorias de status (D5: não depende dos dados da página).
 * `role="list"` explícito — `list-style: none` remove o papel semântico
 * implícito de lista em alguns navegadores (Safari/VoiceOver). Texto sempre
 * presente (nunca só a cor); swatch decorativo `aria-hidden`.
 */
function StatusLegend() {
  const titleId = useId() // AP-FRONTEND-003 — nunca id literal em componente que pode repetir
  return (
    <div
      className="flex flex-wrap items-center gap-4 px-5 py-3 border-b border-line"
      aria-labelledby={titleId}
    >
      <span id={titleId} className="text-xs font-medium text-muted">
        Legenda de status:
      </span>
      <ul role="list" className="flex flex-wrap gap-3 list-none p-0 m-0">
        {STATUS_LEGEND_ITEMS.map((item) => (
          <li key={item.key} className="flex items-center gap-1.5 text-xs text-foreground">
            <span
              aria-hidden="true"
              className="inline-block h-2.5 w-2.5 rounded-full border border-line"
              style={{ backgroundColor: item.tone.backgroundColor }}
            />
            <span>{item.label}</span>
          </li>
        ))}
      </ul>
    </div>
  )
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
  // Opções de "Categoria do atendimento" (MELH-02 — categoria do TIMER, interna).
  // Falha/loading não quebram a tela — mesmo padrão dos demais filtros multi-select.
  const serviceCategoriesQuery = useQuery({
    queryKey: ['service-categories'],
    queryFn: listServiceCategoryOptions,
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
  const serviceCategoryOptions = useMemo<MultiSelectOption<number>[]>(
    () => (serviceCategoriesQuery.data ?? []).map((c) => ({ value: c.id, label: c.nome })),
    [serviceCategoriesQuery.data],
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
        serviceCategoryId:
          filters.serviceCategoryId.length > 0 ? filters.serviceCategoryId : undefined,
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

      {/* Filtro de Categoria HubSpot (107) — só na tela, nunca no export.
          Rótulo renomeado (D6/119) para desambiguar de "Categoria do atendimento". */}
      <MultiSelectCombobox<string>
        id="appointments-categoria"
        label="Categoria (HubSpot)"
        summaryLabel="Categoria (HubSpot)"
        value={filters.categoria}
        options={categoriaOptions}
        onChange={(categoria) => setFilters({ categoria })}
        placeholder="Todas"
        searchable
        isLoading={categoriesQuery.isLoading}
        error={categoriesQuery.isError ? 'Falha ao carregar categorias.' : undefined}
        className="min-w-[220px]"
      />

      {/* Filtro de Categoria do atendimento (MELH-02/119) — categoria do TIMER, interna. */}
      <MultiSelectCombobox<number>
        id="appointments-service-category"
        label="Categoria do atendimento"
        summaryLabel="Categoria do atendimento"
        value={filters.serviceCategoryId}
        options={serviceCategoryOptions}
        onChange={(serviceCategoryId) => setFilters({ serviceCategoryId })}
        placeholder="Todas"
        searchable
        isLoading={serviceCategoriesQuery.isLoading}
        error={
          serviceCategoriesQuery.isError
            ? 'Falha ao carregar categorias de atendimento.'
            : undefined
        }
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
      <StatusLegend />
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
