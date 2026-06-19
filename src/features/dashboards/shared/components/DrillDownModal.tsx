/**
 * Modal de drill-down — reutiliza Modal, DataTable, ExportButtons, Pagination da fundação 002.
 * Colunas exibidas: atendente, equipe, ticket (ID), assunto, data, horas.
 * NUNCA expõe categoria HubSpot (AP-SECURITY-001).
 */

import { useId, useEffect } from 'react'
import { Modal } from '../../../../components/ui/Modal'
import { DataTable } from '../../../../components/ui/DataTable/DataTable'
import { Pagination } from '../../../../components/ui/Pagination'
import { Skeleton } from '../../../../components/ui/Skeleton'
import { ErrorState } from '../../../../components/ui/ErrorState'
import { EmptyState } from '../../../../components/ui/EmptyState'
import { ExportButtons } from '../../../reports/shared/components/ExportButtons'
import { exportToCsv, exportToXlsx } from '../../../reports/shared/utils/exportTable'
import { formatDate, formatSeconds } from '../../../reports/shared/utils/formatters'
import type { ColumnDef, SortState } from '../../../../components/ui/DataTable/types'
import type { TimeEntryRowDto } from '../types/metrics'
import type { useDrillDownRows } from '../hooks/useDrillDownRows'

type DrillDownModalProps = {
  isOpen: boolean
  onClose: () => void
  /** Título do modal — NUNCA interpolado com categoria HubSpot (AP-SECURITY-001) */
  title: string
  /** Hook de drill-down instanciado na página pai */
  drillDown: ReturnType<typeof useDrillDownRows>
  /** Pausa SSE ao abrir (opcional — passar stream.pause) */
  onStreamPause?: () => void
  /** Retoma SSE ao fechar (opcional — passar stream.resume) */
  onStreamResume?: () => void
}

const COLUMNS: ColumnDef<TimeEntryRowDto>[] = [
  {
    key: 'atendente',
    header: 'Atendente',
    accessor: (row) => row.atendente,
    sortable: true,
    sortKey: 'atendente',
  },
  {
    key: 'equipe',
    header: 'Equipe',
    accessor: (row) => row.equipe ?? '—',
  },
  {
    key: 'hubspotTicketId',
    header: 'Ticket',
    accessor: (row) => row.hubspotTicketId,
    sortable: true,
    sortKey: 'hubspotticketid',
  },
  {
    key: 'assunto',
    header: 'Assunto',
    accessor: (row) => row.assunto ?? '—',
  },
  {
    key: 'dataApontamento',
    header: 'Data',
    accessor: (row) => formatDate(row.dataApontamento),
    sortable: true,
    sortKey: 'dataapontamento',
  },
  {
    key: 'totalSegundos',
    header: 'Horas',
    accessor: (row) => formatSeconds(row.totalSegundos),
    sortable: true,
    sortKey: 'totalsegundos',
    align: 'right',
  },
]

export function DrillDownModal({
  isOpen,
  onClose,
  title,
  drillDown,
  onStreamPause,
  onStreamResume,
}: DrillDownModalProps) {
  const modalId = useId()

  // Ao abrir: ativa a query e pausa o SSE
  useEffect(() => {
    if (isOpen) {
      drillDown.enable()
      onStreamPause?.()
    } else {
      drillDown.disable()
      onStreamResume?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  const items = drillDown.data?.items ?? []
  const totalCount = drillDown.data?.totalCount ?? 0
  const totalPages = drillDown.data?.totalPages ?? 0

  const sortState: SortState = {
    sortBy: drillDown.sortBy,
    sortDirection: drillDown.sortDirection,
  }

  function handleExportCsv() {
    const exportCols = COLUMNS.map((c) => ({ header: c.header, key: c.key }))
    const exportRows = items.map((row) =>
      Object.fromEntries(
        COLUMNS.map((c) => [c.key, c.accessor(row) as string | number | null | undefined]),
      ),
    )
    exportToCsv('drill-down', exportCols, exportRows)
  }

  function handleExportXlsx() {
    const exportCols = COLUMNS.map((c) => ({ header: c.header, key: c.key }))
    const exportRows = items.map((row) =>
      Object.fromEntries(
        COLUMNS.map((c) => [c.key, c.accessor(row) as string | number | null | undefined]),
      ),
    )
    void exportToXlsx('drill-down', exportCols, exportRows)
  }

  function renderContent() {
    if (drillDown.isLoading) {
      return <Skeleton lines={8} height="h-[38px]" />
    }
    if (drillDown.isError) {
      return <ErrorState onRetry={drillDown.refetch} />
    }
    if (items.length === 0) {
      return (
        <EmptyState message="Nenhum apontamento encontrado para o período." />
      )
    }
    return (
      <DataTable
        tableId={`drill-down-${modalId}`}
        columns={COLUMNS}
        data={items}
        sortState={sortState}
        onSort={drillDown.setSort}
      />
    )
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="xl"
    >
      <div className="flex flex-col gap-4">
        {/* Botões de export */}
        {!drillDown.isLoading && !drillDown.isError && items.length > 0 && (
          <div className="flex justify-end">
            <ExportButtons
              onExportCsv={handleExportCsv}
              onExportXlsx={handleExportXlsx}
            />
          </div>
        )}

        {/* Conteúdo */}
        {renderContent()}

        {/* Paginação */}
        {totalCount > 0 && (
          <Pagination
            page={drillDown.page}
            pageSize={drillDown.pageSize}
            totalCount={totalCount}
            totalPages={totalPages}
            pageSizeOptions={[25, 50, 100, 200]}
            onPageChange={drillDown.setPage}
            onPageSizeChange={drillDown.setPageSize}
          />
        )}
      </div>
    </Modal>
  )
}
