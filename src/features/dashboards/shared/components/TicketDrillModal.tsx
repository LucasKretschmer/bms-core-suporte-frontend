/**
 * Modal de drill-down da família TICKET (016).
 *
 * Reusa Modal, DataTable, Pagination, ExportButtons (017) e os estados loading/erro/vazio.
 * - Linha clicável → navega para a tela de detalhe do ticket (ticket-detail) pelo id INTERNO.
 * - Export do conjunto FILTRADO COMPLETO via fetchAllPaginated (não só a página visível) — 017 Fase C.
 * - Pausa o SSE ao abrir (onStreamPause/onStreamResume) — não "puxa o tapete" (PRD §6).
 *
 * AP-SECURITY-001: nenhuma coluna/título expõe categoria HubSpot. `status` é o label do pipeline.
 */

import { useId, useEffect, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
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
import { ticketDrillColumns } from '../utils/ticketDrillColumns'
import type { SortState } from '../../../../components/ui/DataTable/types'
import type {
  DrillSpec,
  MetricsBaseParams,
  TicketRowDto,
} from '../types/metrics'
import type { useTicketDrill } from '../hooks/useTicketDrill'

type TicketDrillModalProps = {
  /** DrillSpec ativo — quando null o modal não é exibido. */
  activeDrill: DrillSpec | null
  onClose: () => void
  /** Hook de drill instanciado na página pai (compartilha baseParams). */
  drill: ReturnType<typeof useTicketDrill>
  /** Filtros/scope/período da tela — usados no export do conjunto filtrado completo. */
  baseParams: MetricsBaseParams
  /** Pausa SSE ao abrir (passar stream.pause). */
  onStreamPause?: () => void
  /** Retoma SSE ao fechar (passar stream.resume). */
  onStreamResume?: () => void
}

export function TicketDrillModal({
  activeDrill,
  onClose,
  drill,
  baseParams,
  onStreamPause,
  onStreamResume,
}: TicketDrillModalProps) {
  const modalId = useId()
  const navigate = useNavigate()
  const toast = useToast()
  const [isExporting, setIsExporting] = useState(false)

  const isOpen = activeDrill !== null
  const columns = ticketDrillColumns(activeDrill?.metric ?? 'tickets-backlog')

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

  function handleRowClick(row: TicketRowDto) {
    // Drill até a raiz: navega à tela do ticket pelo id INTERNO (nunca HubSpot id na rota).
    void navigate({
      to: '/relatorios/tickets/$ticketId',
      params: { ticketId: String(row.ticketId) },
      search: { from: 'dashboard' },
    })
  }

  /** Busca o conjunto FILTRADO COMPLETO (todas as páginas) e devolve as linhas exportáveis. */
  async function buildExportRows() {
    if (!activeDrill) return null
    const all = await fetchAllPaginated<TicketRowDto>((page, pageSize) =>
      getMetricRows({
        metric: activeDrill.metric,
        scope: baseParams.scope,
        from: baseParams.from,
        to: baseParams.to,
        clientId: baseParams.clientId,
        statusKey: activeDrill.params?.statusKey ?? null,
        stageId: activeDrill.params?.stageId ?? null,
        sla: activeDrill.params?.sla ?? null,
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
        exportToCsv('drill-down-tickets', built.exportCols, built.exportRows)
        toast.success('Exportação CSV concluída.')
      } else {
        await exportToXlsx('drill-down-tickets', built.exportCols, built.exportRows)
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
        tableId={`ticket-drill-${modalId}`}
        columns={columns}
        data={items}
        sortState={sortState}
        onSort={drill.setSort}
        onRowClick={handleRowClick}
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
