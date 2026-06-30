/**
 * 057 — Apontamentos por Projeto
 *
 * Lista apontamentos (TimeEntries COMPLETED) vinculados a projetos no período.
 * Espelha a stack de "Apontamentos por Ticket" (appointments), porém project-centric:
 * não há hubspotTicketId nem categoria do HubSpot.
 *
 * Acessível a todos os usuários autenticados (AtendentePlus).
 * Export: CSV e Excel com as colunas mapeadas (nunca categoria do HubSpot).
 */

import { useDeferredValue, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
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
import { ClientCombobox } from '../shared/components/ClientCombobox'
import { listProjectAppointments, listTeams } from '../shared/services/reportsService'
import { formatDateTime, formatSeconds } from '../shared/utils/formatters'
import { exportToCsv, exportToXlsx } from '../shared/utils/exportTable'
import type { ExportColumn, ExportRow } from '../shared/utils/exportTable'
import { fetchAllPaginated, ExportLimitError } from '../shared/utils/fetchAllPaginated'
import { usePermissions } from '../../../hooks/usePermissions'
import { useProjectAppointments } from './hooks/useProjectAppointments'
import { buildProjectAppointmentsColumns } from './columns'
import type { ProjectAppointmentReportItemDto } from '../shared/types/reports'

// ── Opções de scope ──────────────────────────────────────────────────────────

const SCOPE_OPTIONS = [
  { value: 'mine', label: 'Meus apontamentos' },
  { value: 'team', label: 'Minha equipe' },
  { value: 'all', label: 'Todos' },
]

// ── Colunas para export (mapeamento de campos simples, sem JSX) ──────────────

const EXPORT_COLUMNS: ExportColumn[] = [
  { header: 'Projeto', key: 'projeto' },
  { header: 'Stage', key: 'stage' },
  { header: 'Cliente', key: 'cliente' },
  { header: 'Equipe', key: 'equipe' },
  { header: 'Atendente', key: 'atendente' },
  { header: 'Categorização do atendimento', key: 'categorizacaoAtendimento' },
  { header: 'Faturamento', key: 'faturamento' },
  { header: 'Data do apontamento', key: 'dataApontamento' },
  { header: 'Tempo', key: 'tempo' },
]

function mapToExportRow(item: ProjectAppointmentReportItemDto): ExportRow {
  return {
    projeto: item.projetoNome ?? '—',
    stage: item.stage ?? '—',
    cliente: item.clienteNome ?? '—',
    equipe: item.equipeAtribuida ?? '—',
    atendente: item.atendente || '—',
    categorizacaoAtendimento: item.categorizacaoAtendimento ?? '—',
    faturamento: item.faturamento,
    dataApontamento: formatDateTime(item.dataApontamento),
    tempo: formatSeconds(item.totalSegundos),
  }
}

// ── Componente principal ─────────────────────────────────────────────────────

export default function ProjectAppointmentsPage() {
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
  } = useProjectAppointments()

  // Opções do filtro de Equipes — loading/erro não quebram a tela.
  const teamsQuery = useQuery({
    queryKey: ['teams'],
    queryFn: listTeams,
    staleTime: 5 * 60 * 1000,
  })

  const teamOptions = useMemo<MultiSelectOption<number>[]>(
    () => (teamsQuery.data ?? []).map((t) => ({ value: t.id, label: t.nome })),
    [teamsQuery.data],
  )

  // Busca textual com debounce
  const [searchInput, setSearchInput] = useState(filters.search)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleSearchChange(value: string) {
    setSearchInput(value)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => {
      setFilters({ search: value })
    }, 300)
  }

  const columns = useMemo(() => buildProjectAppointmentsColumns(), [])

  const sortState = useDeferredValue({ sortBy, sortDirection })

  const isEmpty = !isLoading && !isError && (!data || data.items.length === 0)

  // ── Export ──────────────────────────────────────────────────────────────────

  function fetchAllForExport(): Promise<ProjectAppointmentReportItemDto[]> {
    return fetchAllPaginated<ProjectAppointmentReportItemDto>((page, pageSize) =>
      listProjectAppointments({
        scope: filters.scope,
        search: filters.search || undefined,
        teamId: filters.teamId.length > 0 ? filters.teamId : undefined,
        clientId: filters.clientId ?? undefined,
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
      exportToCsv('apontamentos-por-projeto', EXPORT_COLUMNS, items.map(mapToExportRow))
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
      await exportToXlsx('apontamentos-por-projeto', EXPORT_COLUMNS, items.map(mapToExportRow))
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
      {/* Busca pelo nome do projeto */}
      <Input
        label="Buscar"
        id="project-appointments-search"
        type="text"
        value={searchInput}
        onChange={(e) => handleSearchChange(e.target.value)}
        placeholder="Nome do projeto…"
        className="min-w-[220px]"
      />

      {/* Seletor de scope — apenas para CoordenadorPlus */}
      {isCoordenadorOuAcima && (
        <Combobox
          label="Escopo"
          id="project-appointments-scope"
          value={filters.scope}
          options={SCOPE_OPTIONS}
          onChange={(v) => setFilters({ scope: v as 'mine' | 'team' | 'all' })}
          placeholder="Selecione…"
          className="min-w-[160px]"
        />
      )}

      {/* Filtro por cliente */}
      <ClientCombobox
        value={filters.clientId}
        onChange={(clientId) => setFilters({ clientId })}
        label="Cliente"
        showCnpj={false}
      />

      {/* Filtro de Equipes (multi-select com checkboxes) */}
      <MultiSelectCombobox<number>
        id="project-appointments-teams"
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
      title="Apontamentos por Projeto"
      breadcrumbItems={[
        { label: 'Relatórios' },
        { label: 'Apontamentos por Projeto' },
      ]}
      filters={filters_ui}
      exportActions={export_actions}
      isLoading={isLoading}
      isError={isError}
      isEmpty={isEmpty}
      onRetry={() => void refetch()}
      emptyMessage="Nenhum apontamento de projeto encontrado para os filtros selecionados."
    >
      <DataTable<ProjectAppointmentReportItemDto>
        tableId="project-appointments"
        columns={columns}
        data={data?.items ?? []}
        sortState={sortState}
        onSort={setSort}
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
