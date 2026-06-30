/**
 * F3 — Tela "Detalhe do ticket" (/relatorios/tickets/$ticketId).
 *
 * Header + meta + KPIs + lista de cards de apontamento (com SegmentTimeline).
 * Criar/editar/excluir apontamento via TimeEntryModal (F4).
 * Breadcrumb encadeado conforme a origem do drill-down (F5/R2).
 */

import { useMemo, useState } from 'react'
import { PageWrapper } from '../../components/layout/PageWrapper'
import { EmptyState } from '../../components/ui/EmptyState'
import { ErrorState } from '../../components/ui/ErrorState'
import { Skeleton } from '../../components/ui/Skeleton'
import { usePermissions } from '../../hooks/usePermissions'
import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../../components/ui/Toast'
import { handleApiError } from '../../utils/handleApiError'
import { TicketDetailHeader } from './components/TicketDetailHeader'
import { TicketKpiSummary } from './components/TicketKpiSummary'
import { TimeEntryCard } from './components/TimeEntryCard'
import { TimeEntryModal } from './components/TimeEntryModal'
import { DeleteTimeEntryDialog } from './components/DeleteTimeEntryDialog'
import { useTicketDetail } from './hooks/useTicketDetail'
import { useTicketTimeEntries } from './hooks/useTicketTimeEntries'
import { useTimeEntryMutations } from './hooks/useTimeEntryMutations'
import { useModalOptions } from './hooks/useModalOptions'
import { formatTime } from '../reports/shared/utils/formatters'
import { buildTicketBreadcrumb, type TicketDetailOrigin } from './utils/buildBreadcrumb'
import type { TicketTimeEntryDto } from './types/ticketDetail'

type TicketDetailPageProps = {
  ticketId: number
  from: TicketDetailOrigin
  clientId?: string
}

type ModalState =
  | { open: false }
  | { open: true; mode: 'create' }
  | { open: true; mode: 'edit'; entry: TicketTimeEntryDto }

export default function TicketDetailPage({ ticketId, from, clientId }: TicketDetailPageProps) {
  const { isCoordenadorOuAcima, isGerentePlus } = usePermissions()
  const { user } = useAuth()
  const toast = useToast()
  const currentUserId = user?.id ?? 0

  const headerQuery = useTicketDetail(ticketId)
  const entriesQuery = useTicketTimeEntries(ticketId)
  const { remove } = useTimeEntryMutations(ticketId)

  const [modal, setModal] = useState<ModalState>({ open: false })
  const [deleteTarget, setDeleteTarget] = useState<TicketTimeEntryDto | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const { agentOptions, categoryOptions, isLoading: optionsLoading } = useModalOptions(modal.open)

  const ticket = headerQuery.data

  const breadcrumbItems = useMemo(
    () =>
      buildTicketBreadcrumb({
        from,
        clientId,
        clienteNome: ticket?.client?.nomeFantasia ?? null,
        hubspotTicketId: ticket?.hubspotTicketId ?? '',
      }),
    [from, clientId, ticket?.client?.nomeFantasia, ticket?.hubspotTicketId],
  )

  const ticketLabel = ticket
    ? `#${ticket.hubspotTicketId} — ${ticket.assunto ?? 'Sem assunto'}`
    : ''

  /** Atendente edita só o próprio; Coordenador+ qualquer um. */
  function canEditEntry(entry: TicketTimeEntryDto): boolean {
    return isCoordenadorOuAcima || entry.userId === currentUserId
  }

  /** Exclusão com motivo é restrita a gestor (Gerente/Admin) — 047. */
  const canDeleteEntries = isGerentePlus

  /** Rótulo curto do apontamento para contextualizar o diálogo de exclusão. */
  function entryLabel(entry: TicketTimeEntryDto): string {
    const agente = entry.agenteNome?.trim() || 'Atendente'
    return `${agente} · ${formatTime(entry.startTime)}`
  }

  function openDelete(entry: TicketTimeEntryDto) {
    setDeleteError(null)
    setDeleteTarget(entry)
  }

  function handleConfirmDelete(reason: string) {
    if (!deleteTarget) return
    setDeleteError(null)
    remove.mutate(
      { id: deleteTarget.id, reason },
      {
        onSuccess: () => {
          toast.success('Apontamento excluído.')
          setDeleteTarget(null)
        },
        onError: (err) => {
          const msg = handleApiError(err)
          setDeleteError(msg)
          toast.error(msg)
        },
      },
    )
  }

  const entries = entriesQuery.data ?? []
  const entriesEmpty =
    !entriesQuery.isLoading && !entriesQuery.isError && entries.length === 0

  return (
    <PageWrapper breadcrumbItems={breadcrumbItems}>
      <div className="flex flex-col gap-4">
        {/* Header */}
        {headerQuery.isLoading && (
          <div className="rounded-xl border border-border bg-card p-4">
            <Skeleton lines={3} />
          </div>
        )}
        {!headerQuery.isLoading && headerQuery.isError && (
          <ErrorState onRetry={() => void headerQuery.refetch()} />
        )}
        {ticket && (
          <TicketDetailHeader
            ticket={ticket}
            canCreate
            onAddAppointment={() => setModal({ open: true, mode: 'create' })}
          />
        )}

        {/* KPIs (dependem da lista) */}
        {!entriesQuery.isLoading && !entriesQuery.isError && (
          <TicketKpiSummary entries={entries} />
        )}

        {/* Lista de apontamentos */}
        <section aria-label="Apontamentos do ticket" className="flex flex-col gap-3">
          {entriesQuery.isLoading && (
            <div className="rounded-xl border border-border bg-card p-4">
              <Skeleton lines={5} />
            </div>
          )}
          {!entriesQuery.isLoading && entriesQuery.isError && (
            <ErrorState onRetry={() => void entriesQuery.refetch()} />
          )}
          {entriesEmpty && (
            <EmptyState
              message="Nenhum lançamento neste ticket."
              action={{
                label: 'Adicionar apontamento',
                onClick: () => setModal({ open: true, mode: 'create' }),
              }}
            />
          )}
          {!entriesQuery.isLoading &&
            !entriesQuery.isError &&
            entries.map((entry) => (
              <TimeEntryCard
                key={entry.id}
                entry={entry}
                canEdit={canEditEntry(entry)}
                onEdit={(e) => setModal({ open: true, mode: 'edit', entry: e })}
                canDelete={canDeleteEntries}
                onDelete={openDelete}
              />
            ))}
        </section>
      </div>

      {modal.open && (
        <TimeEntryModal
          isOpen={modal.open}
          mode={modal.mode}
          ticketId={ticketId}
          ticketLabel={ticketLabel}
          entry={modal.mode === 'edit' ? modal.entry : undefined}
          agentOptions={agentOptions}
          categoryOptions={categoryOptions}
          optionsLoading={optionsLoading}
          canChangeAgent={isCoordenadorOuAcima}
          currentUserId={currentUserId}
          canDelete={modal.mode === 'edit' && canDeleteEntries}
          onClose={() => setModal({ open: false })}
          onRequestDelete={(e) => {
            setModal({ open: false })
            openDelete(e)
          }}
          onSubmitted={() => {
            void entriesQuery.refetch()
          }}
        />
      )}

      <DeleteTimeEntryDialog
        isOpen={deleteTarget !== null}
        entryLabel={deleteTarget ? entryLabel(deleteTarget) : undefined}
        isSubmitting={remove.isPending}
        apiError={deleteError}
        onConfirm={handleConfirmDelete}
        onClose={() => {
          if (remove.isPending) return
          setDeleteTarget(null)
          setDeleteError(null)
        }}
      />
    </PageWrapper>
  )
}
