import { useCallback, useRef, useState } from 'react'
import { DataTable } from '../../../components/ui/DataTable/DataTable'
import { Pagination } from '../../../components/ui/Pagination'
import { ReportPageLayout } from '../../../components/layout/ReportPageLayout'
import { useToast } from '../../../components/ui/Toast'
import { ExportButtons } from '../shared/components/ExportButtons'
import { PeriodFilter } from '../shared/components/PeriodFilter'
import { TeamCombobox } from '../shared/components/TeamCombobox'
import { exportToCsv, exportToXlsx } from '../shared/utils/exportTable'
import { ExportLimitError } from '../shared/utils/fetchAllPaginated'
import type { ProductivityReportItemDto } from '../shared/types/reports'
import { productivityColumns } from './columns'
import { ProductivityAppointmentsModal } from './components/ProductivityAppointmentsModal'
import { ProductivitySummaryCards } from './components/ProductivitySummaryCards'
import { PRODUCTIVITY_EXPORT_COLUMNS, mapToExportRow } from './exportRow'
import { fetchProductivityForExport } from './fetchProductivityForExport'
import { useProductivity } from './hooks/useProductivity'
import { CLASSE_LINHA_ACIMA_DO_LIMITE } from './productivityFormat'

const TABLE_ID = 'productivity'
const EXPORT_FILENAME = 'produtividade-analistas'

/** Produtividade por Analista. Rota restrita a CoordenadorPlus. */
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

  const [analistaAberto, setAnalistaAberto] = useState<ProductivityReportItemDto | null>(null)
  const lastTriggerRef = useRef<HTMLElement | null>(null)

  const handleRowClick = useCallback((row: ProductivityReportItemDto) => {
    lastTriggerRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null
    setAnalistaAberto(row)
  }, [])

  const handleCloseDrill = useCallback(() => {
    setAnalistaAberto(null)
    const trigger = lastTriggerRef.current
    if (trigger && document.contains(trigger)) {
      window.setTimeout(() => trigger.focus(), 0)
    }
  }, [])

  async function handleExport(formato: 'csv' | 'xlsx') {
    if (isExporting) return
    setIsExporting(true)
    toast.info('Carregando dados para exportar…')
    try {
      const items = await fetchProductivityForExport(filters, { sortBy, sortDirection })
      const rows = items.map(mapToExportRow)
      if (formato === 'csv') {
        exportToCsv(EXPORT_FILENAME, PRODUCTIVITY_EXPORT_COLUMNS, rows)
        toast.success('Exportação CSV concluída.')
      } else {
        await exportToXlsx(EXPORT_FILENAME, PRODUCTIVITY_EXPORT_COLUMNS, rows)
        toast.success('Exportação Excel concluída.')
      }
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
      breadcrumbItems={[{ label: 'Relatórios' }, { label: 'Produtividade por Analista' }]}
      summary={
        <ProductivitySummaryCards
          params={{ from: filters.from, to: filters.to, teamId: filters.teamId }}
          variant="global"
          ariaLabel="Resumo de produtividade do período"
        />
      }
      filters={
        <div className="flex flex-wrap items-end gap-3">
          <PeriodFilter
            from={filters.from}
            to={filters.to}
            onChange={(from, to) => setFilters({ from, to })}
          />
          <TeamCombobox value={filters.teamId} onChange={(teamId) => setFilters({ teamId })} />
        </div>
      }
      exportActions={
        <ExportButtons
          onExportCsv={() => void handleExport('csv')}
          onExportXlsx={() => void handleExport('xlsx')}
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
        onRowClick={handleRowClick}
        rowClassName={(row) =>
          row.extrapolouJornada === true ? CLASSE_LINHA_ACIMA_DO_LIMITE : undefined
        }
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

      {analistaAberto && (
        <ProductivityAppointmentsModal
          key={analistaAberto.userId}
          userId={analistaAberto.userId}
          analistaNome={analistaAberto.nome}
          from={filters.from}
          to={filters.to}
          onClose={handleCloseDrill}
        />
      )}
    </ReportPageLayout>
  )
}
