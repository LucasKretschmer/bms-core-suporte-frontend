/**
 * Tela de logs de Movimentação Diária (021 — item 38).
 *
 * Lista as linhas do snapshot diário (uma por data × bucket/stage × equipe):
 * Data · Status · Equipe · Quantidade · Última atualização.
 *
 * Filtros: período (de/até), equipe, bucket de status, busca textual.
 * Export: CSV e Excel do conjunto FILTRADO completo (nunca só a página visível).
 * Acesso: CoordenadorPlus (mesma policy do endpoint — backend é a fonte de verdade).
 */

import { useRef, useState } from 'react'
import { ReportPageLayout } from '../../components/layout/ReportPageLayout'
import { DataTable } from '../../components/ui/DataTable/DataTable'
import { Pagination } from '../../components/ui/Pagination'
import { Input } from '../../components/ui/Input'
import { Combobox } from '../../components/ui/Combobox'
import { useToast } from '../../components/ui/Toast'
import { ExportButtons } from '../reports/shared/components/ExportButtons'
import { PeriodFilter } from '../reports/shared/components/PeriodFilter'
import { TeamCombobox } from '../reports/shared/components/TeamCombobox'
import { exportToCsv, exportToXlsx } from '../reports/shared/utils/exportTable'
import type { ExportColumn, ExportRow } from '../reports/shared/utils/exportTable'
import { fetchAllPaginated, ExportLimitError } from '../reports/shared/utils/fetchAllPaginated'
import { formatDate, formatDateTime } from '../reports/shared/utils/formatters'
import { useMovimentacaoDiariaLogs, buildScope } from './hooks/useMovimentacaoDiariaLogs'
import { listMovimentacaoDiaria } from './services/movimentacaoDiariaService'
import { buildMovimentacaoDiariaColumns } from './columns'
import { STATUS_BUCKET_OPTIONS, formatStatusDisplay, isStatusBucket } from './utils/statusBucket'
import type { MovimentacaoDiariaRowDto, StatusBucket } from './types/movimentacaoDiaria'

const ALL_BUCKETS = '__all__'

const EXPORT_COLUMNS: ExportColumn[] = [
  { header: 'Data', key: 'data' },
  { header: 'Status', key: 'status' },
  { header: 'Equipe', key: 'equipe' },
  { header: 'Quantidade', key: 'quantidade' },
  { header: 'Última atualização', key: 'atualizadoEm' },
]

function mapToExportRow(item: MovimentacaoDiariaRowDto): ExportRow {
  return {
    data: formatDate(`${item.data}T12:00:00`),
    status: formatStatusDisplay(item.statusBucket, item.statusLabel),
    equipe: item.equipe ?? 'Sem equipe',
    quantidade: item.quantidade,
    atualizadoEm: formatDateTime(item.atualizadoEm),
  }
}

const BUCKET_OPTIONS = [
  { value: ALL_BUCKETS, label: 'Todos os status' },
  ...STATUS_BUCKET_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
]

export default function MovimentacaoDiariaPage() {
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
  } = useMovimentacaoDiariaLogs()

  // Busca textual com debounce
  const [searchInput, setSearchInput] = useState(filters.search)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleSearchChange(value: string) {
    setSearchInput(value)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => setFilters({ search: value }), 300)
  }

  const columns = buildMovimentacaoDiariaColumns()

  const selectedBucket: string =
    filters.statusBucket.length > 0 ? filters.statusBucket[0] : ALL_BUCKETS

  function handleBucketChange(value: string) {
    if (value === ALL_BUCKETS || !isStatusBucket(value)) {
      setFilters({ statusBucket: [] })
    } else {
      setFilters({ statusBucket: [value satisfies StatusBucket] })
    }
  }

  const sortState = { sortBy, sortDirection }
  const isEmpty = !isLoading && !isError && (!data || data.items.length === 0)

  // ── Export ────────────────────────────────────────────────────────────────
  function fetchAllForExport(): Promise<MovimentacaoDiariaRowDto[]> {
    return fetchAllPaginated<MovimentacaoDiariaRowDto>((page, pageSize) =>
      listMovimentacaoDiaria({
        scope: buildScope(filters.equipeId),
        from: filters.from ?? undefined,
        to: filters.to ?? undefined,
        statusBucket: filters.statusBucket.length > 0 ? filters.statusBucket : undefined,
        search: filters.search || undefined,
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
      exportToCsv('movimentacao-diaria', EXPORT_COLUMNS, items.map(mapToExportRow))
      toast.success('Exportação CSV concluída.')
    } catch (err) {
      toast.error(err instanceof ExportLimitError ? err.message : 'Erro ao exportar. Tente novamente.')
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
      await exportToXlsx('movimentacao-diaria', EXPORT_COLUMNS, items.map(mapToExportRow))
      toast.success('Exportação Excel concluída.')
    } catch (err) {
      toast.error(err instanceof ExportLimitError ? err.message : 'Erro ao exportar. Tente novamente.')
    } finally {
      setIsExporting(false)
    }
  }

  // ── UI ────────────────────────────────────────────────────────────────────
  const filters_ui = (
    <div className="flex flex-wrap items-end gap-3">
      <Input
        label="Buscar"
        id="movimentacao-search"
        type="text"
        value={searchInput}
        onChange={(e) => handleSearchChange(e.target.value)}
        placeholder="Status ou equipe…"
        className="min-w-[200px]"
      />

      <TeamCombobox
        value={filters.equipeId === null ? null : String(filters.equipeId)}
        onChange={(teamId) => setFilters({ equipeId: teamId === null ? null : Number(teamId) })}
      />

      <Combobox
        label="Status"
        id="movimentacao-bucket"
        value={selectedBucket}
        options={BUCKET_OPTIONS}
        onChange={handleBucketChange}
        placeholder="Todos os status"
        className="min-w-[200px]"
      />

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
      title="Movimentação Diária"
      breadcrumbItems={[{ label: 'Relatórios' }, { label: 'Movimentação Diária' }]}
      filters={filters_ui}
      exportActions={export_actions}
      isLoading={isLoading}
      isError={isError}
      isEmpty={isEmpty}
      onRetry={() => void refetch()}
      emptyMessage="Nenhuma movimentação encontrada para os filtros selecionados."
    >
      <DataTable<MovimentacaoDiariaRowDto>
        tableId="movimentacao-diaria"
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
