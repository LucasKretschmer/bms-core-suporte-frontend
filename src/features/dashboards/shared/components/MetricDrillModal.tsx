/**
 * Modal de drill-down GENÉRICO (016) — agnóstico de família.
 *
 * Reusa Modal, DataTable, Pagination, ExportButtons (017) e os estados loading/erro/vazio.
 * O chamador fornece as colunas (por família) e, opcionalmente, um handler de clique na
 * linha (navegação à raiz). Famílias sem destino de detalhe (projeto, R5) não passam
 * onRowClick → a linha não é clicável.
 *
 * - Export do conjunto FILTRADO COMPLETO via fetchAllPaginated (não só a página visível) — 017.
 * - Pausa o SSE ao abrir (onStreamPause/onStreamResume) — não "puxa o tapete" (PRD §6).
 *
 * AP-SECURITY-001: a responsabilidade de não expor categoria HubSpot é das colunas
 * fornecidas (apontamento/cliente/projeto/ticket columns já respeitam a regra).
 */

import { useId, useEffect, useState } from 'react'
import { Modal } from '../../../../components/ui/Modal'
import { DataTable } from '../../../../components/ui/DataTable/DataTable'
import { Pagination } from '../../../../components/ui/Pagination'
import { Skeleton } from '../../../../components/ui/Skeleton'
import { ErrorState } from '../../../../components/ui/ErrorState'
import { EmptyState } from '../../../../components/ui/EmptyState'
import { ExportButtons } from '../../../reports/shared/components/ExportButtons'
import { exportToCsv, exportToXlsx } from '../../../reports/shared/utils/exportTable'
import {
  fetchAllPaginated,
  ExportLimitError,
} from '../../../reports/shared/utils/fetchAllPaginated'
import { useToast } from '../../../../components/ui/Toast'
import { getMetricRows } from '../services/metricsService'
import type { SortState, ColumnDef } from '../../../../components/ui/DataTable/types'
import type { DrillSpec, MetricsBaseParams } from '../types/metrics'
import type { UseMetricDrillReturn } from '../hooks/useMetricDrill'

type MetricDrillModalProps<T> = {
  /** DrillSpec ativo — quando null o modal não é exibido. */
  activeDrill: DrillSpec | null
  onClose: () => void
  /** Hook de drill instanciado na página pai (compartilha baseParams). */
  drill: UseMetricDrillReturn<T>
  /** Colunas da família (por metric). */
  columns: ColumnDef<T>[]
  /** Filtros/scope/período da tela — usados no export do conjunto filtrado completo. */
  baseParams: MetricsBaseParams
  /** Navegação à raiz ao clicar na linha. Omitir → linha não clicável (ex.: projeto, R5). */
  onRowClick?: (row: T) => void
  /** Prefixo do arquivo exportado (ex.: 'drill-down-apontamentos'). */
  exportFilename: string
  /** Pausa SSE ao abrir (passar stream.pause). */
  onStreamPause?: () => void
  /** Retoma SSE ao fechar (passar stream.resume). */
  onStreamResume?: () => void
}

export function MetricDrillModal<T>({
  activeDrill,
  onClose,
  drill,
  columns,
  baseParams,
  onRowClick,
  exportFilename,
  onStreamPause,
  onStreamResume,
}: MetricDrillModalProps<T>) {
  const modalId = useId()
  const toast = useToast()
  const [isExporting, setIsExporting] = useState(false)

  const isOpen = activeDrill !== null

  // Pausa o SSE enquanto o drill está aberto e retoma ao desmontar/fechar — o live update
  // não "puxa o tapete" com o modal aberto (PRD §6). O componente é montado apenas quando
  // há drill ativo, então pausar no mount / retomar no cleanup cobre abrir e fechar.
  useEffect(() => {
    onStreamPause?.()
    return () => {
      onStreamResume?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const items = drill.data?.items ?? []
  const totalCount = drill.data?.totalCount ?? 0
  const totalPages = drill.data?.totalPages ?? 0

  const sortState: SortState = {
    sortBy: drill.sortBy,
    sortDirection: drill.sortDirection,
  }

  /** Busca o conjunto FILTRADO COMPLETO (todas as páginas) e devolve as linhas exportáveis. */
  async function buildExportRows() {
    if (!activeDrill) return null
    const p = activeDrill.params
    const all = await fetchAllPaginated<T>((page, pageSize) =>
      getMetricRows<T>({
        metric: activeDrill.metric,
        scope: baseParams.scope,
        from: baseParams.from,
        to: baseParams.to,
        clientId: baseParams.clientId,
        supportPlanId: baseParams.supportPlanId,
        statusKey: p?.statusKey ?? null,
        stageId: p?.stageId ?? null,
        sla: p?.sla ?? null,
        billing: p?.billing ?? null,
        serviceCategory: p?.serviceCategory ?? null,
        categoria: p?.categoria ?? null,
        userId: p?.userId ?? null,
        faixa: p?.faixa ?? null,
        tipo: p?.tipo ?? null,
        stage: p?.stage ?? null,
        sortBy: drill.sortBy,
        sortDirection: drill.sortDirection,
        page,
        pageSize,
      }),
    )
    const exportCols = columns.map((c) => ({ header: c.header, key: c.key }))
    const exportRows = all.map((row) =>
      Object.fromEntries(
        columns.map((c) => [c.key, c.accessor(row) as string | number | null | undefined]),
      ),
    )
    return { exportCols, exportRows }
  }

  async function runExport(kind: 'csv' | 'xlsx') {
    if (isExporting) return
    setIsExporting(true)
    toast.info('Carregando dados para exportar…')
    try {
      const built = await buildExportRows()
      if (!built) return
      if (kind === 'csv') {
        exportToCsv(exportFilename, built.exportCols, built.exportRows)
        toast.success('Exportação CSV concluída.')
      } else {
        await exportToXlsx(exportFilename, built.exportCols, built.exportRows)
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

  function renderContent() {
    if (drill.isLoading) {
      return <Skeleton lines={8} height="h-[38px]" />
    }
    if (drill.isError) {
      return <ErrorState onRetry={drill.refetch} />
    }
    if (items.length === 0) {
      return <EmptyState message="Nenhum registro encontrado para o período." />
    }
    return (
      <DataTable
        tableId={`metric-drill-${modalId}`}
        columns={columns}
        data={items}
        sortState={sortState}
        onSort={drill.setSort}
        onRowClick={onRowClick}
      />
    )
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={activeDrill?.title ?? 'Detalhes'}
      size="xl"
    >
      <div className="flex flex-col gap-4">
        {!drill.isLoading && !drill.isError && items.length > 0 && (
          <div className="flex justify-end">
            <ExportButtons
              onExportCsv={() => void runExport('csv')}
              onExportXlsx={() => void runExport('xlsx')}
              isExporting={isExporting}
            />
          </div>
        )}

        {renderContent()}

        {totalCount > 0 && (
          <Pagination
            page={drill.page}
            pageSize={drill.pageSize}
            totalCount={totalCount}
            totalPages={totalPages}
            pageSizeOptions={[25, 50, 100, 200]}
            onPageChange={drill.setPage}
            onPageSizeChange={drill.setPageSize}
          />
        )}
      </div>
    </Modal>
  )
}
