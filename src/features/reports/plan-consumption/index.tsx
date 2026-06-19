import { useCallback, useRef, useState } from 'react'
import { DataTable } from '../../../components/ui/DataTable/DataTable'
import { Input } from '../../../components/ui/Input'
import { Pagination } from '../../../components/ui/Pagination'
import { ReportPageLayout } from '../../../components/layout/ReportPageLayout'
import { ExportButtons } from '../shared/components/ExportButtons'
import { PeriodFilter } from '../shared/components/PeriodFilter'
import { PlanCombobox } from '../shared/components/PlanCombobox'
import { exportToCsv, exportToXlsx } from '../shared/utils/exportTable'
import type { ExportColumn } from '../shared/utils/exportTable'
import { listPlanConsumption } from '../shared/services/reportsService'
import { planConsumptionColumns } from './columns'
import { usePlanConsumption } from './hooks/usePlanConsumption'
import { formatHours, formatPercent } from '../shared/utils/formatters'

/** Chave única para persistência da ordem das colunas */
const TABLE_ID = 'plan-consumption'

/**
 * Página U3 — Consumo de Planos.
 * Restrita a CoordenadorPlus (guarda de rota configurada em routes/_auth/relatorios/consumo-planos.tsx).
 */
export default function PlanConsumptionPage() {
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
  } = usePlanConsumption()

  // Debounce para o campo de busca
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [searchInput, setSearchInput] = useState('')

  function handleSearchChange(value: string) {
    setSearchInput(value)
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
    searchDebounceRef.current = setTimeout(() => {
      setFilters({ search: value })
    }, 300)
  }

  // Export state
  const [isExporting, setIsExporting] = useState(false)

  // Colunas para export (sem headerNode — apenas texto simples)
  const exportColumns: ExportColumn[] = [
    { header: 'CNPJ', key: 'cnpj' },
    { header: 'Nome Fantasia', key: 'nomeFantasia' },
    { header: 'Razão Social', key: 'razaoSocial' },
    { header: 'Nome do Plano', key: 'nomePlano' },
    { header: 'Qtde. Plano (h)', key: 'qtdePlanoHoras' },
    { header: 'Horas Usadas', key: 'horasUsadas' },
    { header: 'Horas Restantes', key: 'horasRestantes' },
    { header: 'Horas Adicionais', key: 'horasAdicionais' },
    { header: '% do Plano', key: 'percentualPlano' },
    { header: 'Horas Faturáveis', key: 'horasFaturaveis' },
    { header: 'Horas de Análise', key: 'horasAnalise' },
  ]

  /** Busca todas as páginas para export completo */
  const fetchAllForExport = useCallback(async () => {
    const PAGE_SIZE = 200
    const allItems: Record<string, string | number | null>[] = []
    let currentPage = 1
    let totalPages = 1

    do {
      const result = await listPlanConsumption({
        search: filters.search || undefined,
        planId: filters.planId,
        from: filters.from,
        to: filters.to,
        sortBy,
        sortDirection,
        page: currentPage,
        pageSize: PAGE_SIZE,
      })
      totalPages = result.totalPages
      result.items.forEach((item) => {
        allItems.push({
          cnpj: item.cnpj ?? '—',
          nomeFantasia: item.nomeFantasia ?? '—',
          razaoSocial: item.razaoSocial ?? '—',
          nomePlano: item.nomePlano ?? '—',
          qtdePlanoHoras: formatHours(item.qtdePlanoHoras),
          horasUsadas: formatHours(item.horasUsadas),
          horasRestantes: formatHours(item.horasRestantes),
          horasAdicionais: formatHours(item.horasAdicionais),
          percentualPlano: formatPercent(item.percentualPlano),
          horasFaturaveis: formatHours(item.horasFaturaveis),
          horasAnalise: formatHours(item.horasAnalise),
        })
      })
      currentPage++
    } while (currentPage <= totalPages)

    return allItems
  }, [filters, sortBy, sortDirection])

  async function handleExportCsv() {
    setIsExporting(true)
    try {
      const rows = await fetchAllForExport()
      exportToCsv('consumo-planos', exportColumns, rows)
    } finally {
      setIsExporting(false)
    }
  }

  async function handleExportXlsx() {
    setIsExporting(true)
    try {
      const rows = await fetchAllForExport()
      await exportToXlsx('consumo-planos', exportColumns, rows)
    } finally {
      setIsExporting(false)
    }
  }

  const isEmpty = !isLoading && !isError && (!data || data.items.length === 0)

  return (
    <ReportPageLayout
      title="Consumo de Planos"
      breadcrumbItems={[
        { label: 'Relatórios' },
        { label: 'Consumo de Planos' },
      ]}
      filters={
        <div className="flex flex-wrap items-end gap-3">
          <Input
            label="Buscar"
            placeholder="Nome, CNPJ..."
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="min-w-[220px]"
          />
          <PlanCombobox
            value={filters.planId}
            onChange={(planId) => setFilters({ planId })}
          />
          <PeriodFilter
            from={filters.from}
            to={filters.to}
            onChange={(from, to) => setFilters({ from, to })}
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
      emptyMessage="Nenhum cliente com plano encontrado para os filtros selecionados."
    >
      <DataTable
        tableId={TABLE_ID}
        columns={planConsumptionColumns}
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
            pageSizeOptions={[10, 25, 50, 100, 200]}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </div>
      )}
    </ReportPageLayout>
  )
}
