import { useCallback, useState } from 'react'
import { DataTable } from '../../../components/ui/DataTable/DataTable'
import { Pagination } from '../../../components/ui/Pagination'
import { ReportPageLayout } from '../../../components/layout/ReportPageLayout'
import { ExportButtons } from '../shared/components/ExportButtons'
import { PeriodFilter } from '../shared/components/PeriodFilter'
import { TeamCombobox } from '../shared/components/TeamCombobox'
import { exportToCsv, exportToXlsx } from '../shared/utils/exportTable'
import type { ExportColumn, ExportRow } from '../shared/utils/exportTable'
import { fetchAllPaginated, ExportLimitError } from '../shared/utils/fetchAllPaginated'
import { listProductivity } from '../shared/services/reportsService'
import { useToast } from '../../../components/ui/Toast'
import type { AgentMetricDto } from '../shared/types/reports'
import { productivityColumns } from './columns'
import { useProductivity } from './hooks/useProductivity'
import { formatSeconds, formatDecimal } from '../shared/utils/formatters'

/** Chave única para persistência da ordem das colunas */
const TABLE_ID = 'productivity'

/**
 * Página U6 — Produtividade por Analista.
 * Restrita a CoordenadorPlus (guarda de rota configurada em routes/_auth/relatorios/produtividade.tsx).
 */
export default function ProductivityPage() {
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
  } = useProductivity()

  const [isExporting, setIsExporting] = useState(false)
  const toast = useToast()

  const exportColumns: ExportColumn[] = [
    { header: 'Analista', key: 'nome' },
    { header: 'Equipe', key: 'equipe' },
    { header: 'Atendimentos', key: 'nAtendimentos' },
    { header: 'Tempo Total', key: 'totalSegundos' },
    { header: 'AHT (Tempo Médio)', key: 'ahtSegundos' },
    { header: 'Média de Pausas', key: 'mediaPausas' },
  ]

  function mapToExportRow(item: AgentMetricDto): ExportRow {
    return {
      nome: item.nome,
      equipe: item.equipe ?? '—',
      nAtendimentos: item.nAtendimentos,
      totalSegundos: formatSeconds(item.totalSegundos),
      ahtSegundos: item.ahtSegundos !== null ? formatSeconds(item.ahtSegundos) : '—',
      mediaPausas: formatDecimal(item.mediaPausas),
    }
  }

  /** Busca todas as páginas do conjunto filtrado para export completo */
  const fetchAllForExport = useCallback(
    () =>
      fetchAllPaginated<AgentMetricDto>((page, pageSize) =>
        listProductivity({
          from: filters.from,
          to: filters.to,
          teamId: filters.teamId,
          page,
          pageSize,
        }),
      ),
    [filters],
  )

  async function handleExportCsv() {
    if (isExporting) return
    setIsExporting(true)
    toast.info('Carregando dados para exportar…')
    try {
      const items = await fetchAllForExport()
      exportToCsv('produtividade-analistas', exportColumns, items.map(mapToExportRow))
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
      await exportToXlsx('produtividade-analistas', exportColumns, items.map(mapToExportRow))
      toast.success('Exportação Excel concluída.')
    } catch (err) {
      toast.error(
        err instanceof ExportLimitError ? err.message : 'Erro ao exportar. Tente novamente.',
      )
    } finally {
      setIsExporting(false)
    }
  }

  const isEmpty = !isLoading && !isError && (!data || data.items.length === 0)

  return (
    <ReportPageLayout
      title="Produtividade por Analista"
      breadcrumbItems={[
        { label: 'Relatórios' },
        { label: 'Produtividade por Analista' },
      ]}
      filters={
        <div className="flex flex-wrap items-end gap-3">
          <PeriodFilter
            from={filters.from}
            to={filters.to}
            onChange={(from, to) => setFilters({ from, to })}
          />
          <TeamCombobox
            value={filters.teamId}
            onChange={(teamId) => setFilters({ teamId })}
          />
        </div>
      }
      exportActions={
        <ExportButtons
          onExportCsv={() => void handleExportCsv()}
          onExportXlsx={() => void handleExportXlsx()}
          isExporting={isExporting}
        />
      }
      isLoading={isLoading}
      isError={isError}
      isEmpty={isEmpty}
      onRetry={refetch}
      emptyMessage="Nenhum dado de produtividade encontrado para o período selecionado."
    >
      <DataTable
        tableId={TABLE_ID}
        columns={productivityColumns}
        data={data?.items ?? []}
        sortState={{ sortBy, sortDirection }}
        onSort={setSort}
      />
      {data && data.totalPages > 0 && (
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
