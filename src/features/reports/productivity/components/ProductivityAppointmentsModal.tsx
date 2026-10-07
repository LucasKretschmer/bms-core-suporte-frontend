import { useNavigate } from '@tanstack/react-router'
import { DataTable } from '../../../../components/ui/DataTable/DataTable'
import { EmptyState } from '../../../../components/ui/EmptyState'
import { ErrorState } from '../../../../components/ui/ErrorState'
import { Modal } from '../../../../components/ui/Modal'
import { Pagination } from '../../../../components/ui/Pagination'
import { Skeleton } from '../../../../components/ui/Skeleton'
import type { AppointmentReportItemDto } from '../../shared/types/reports'
import { appointmentDrillColumns } from '../appointmentDrillColumns'
import { useProductivityAppointments } from '../hooks/useProductivityAppointments'
import { CLASSE_LINHA_ACIMA_DO_LIMITE } from '../productivityFormat'
import { ProductivitySummaryCards } from './ProductivitySummaryCards'

type ProductivityAppointmentsModalProps = {
  userId: number
  analistaNome: string
  from: string | null
  to: string | null
  onClose: () => void
}

export function ProductivityAppointmentsModal({
  userId,
  analistaNome,
  from,
  to,
  onClose,
}: ProductivityAppointmentsModalProps) {
  const navigate = useNavigate()
  const {
    data,
    isLoading,
    isError,
    refetch,
    sortBy,
    sortDirection,
    setPage,
    setPageSize,
    setSort,
  } = useProductivityAppointments({ userId, from, to })

  function handleAppointmentClick(row: AppointmentReportItemDto) {
    void navigate({
      to: '/relatorios/tickets/$ticketId',
      params: { ticketId: String(row.ticketId) },
    })
  }

  function renderAppointments() {
    if (isLoading) return <Skeleton lines={6} />
    if (isError) {
      return (
        <ErrorState
          message="Não foi possível carregar os apontamentos do analista."
          onRetry={refetch}
        />
      )
    }
    if (!data || data.items.length === 0) {
      return <EmptyState message="Nenhum apontamento do analista no período selecionado." />
    }
    return (
      <div className="rounded-card border border-border">
        <DataTable
          tableId={`productivity-appointments-${userId}`}
          columns={appointmentDrillColumns}
          data={data.items}
          sortState={{ sortBy, sortDirection }}
          onSort={setSort}
          onRowClick={handleAppointmentClick}
          rowClassName={(row) => (row.acimaDoLimite === true ? CLASSE_LINHA_ACIMA_DO_LIMITE : undefined)}
        />
        {data.totalPages > 0 && (
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
      </div>
    )
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={`Apontamentos de ${analistaNome}`}
      size="xl"
      className="max-w-[90vw] w-[90vw]"
    >
      <div className="flex flex-col gap-4">
        <ProductivitySummaryCards
          params={{ from, to, userId }}
          variant="atendente"
          ariaLabel={`Resumo de ${analistaNome}`}
        />
        {renderAppointments()}
      </div>
    </Modal>
  )
}
