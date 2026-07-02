/**
 * F3 — Tela "Detalhe do ticket" (/relatorios/tickets/$ticketId).
 *
 * Header + meta + KPIs + lista de cards de apontamento (com SegmentTimeline).
 * Criar/editar apontamento via TimeEntryModal (F4). Cancelar/restaurar (099).
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
import { CancelTimeEntryDialog } from './components/CancelTimeEntryDialog'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
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
  const { cancel, restore } = useTimeEntryMutations(ticketId)

  const [modal, setModal] = useState<ModalState>({ open: false })
  const [cancelTarget, setCancelTarget] = useState<TicketTimeEntryDto | null>(null)
  const [cancelError, setCancelError] = useState<string | null>(null)
  const [restoreTarget, setRestoreTarget] = useState<TicketTimeEntryDto | null>(null)
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

  /** Cancelar/restaurar apontamento é restrito a gestor (Gerente/Admin) — 099. */
  const canManageEntries = isGerentePlus

  /** Rótulo curto do apontamento para contextualizar o diálogo de cancelamento. */
  function entryLabel(entry: TicketTimeEntryDto): string {
    const agente = entry.agenteNome?.trim() || 'Atendente'
    return `${agente} · ${formatTime(entry.startTime)}`
  }

  function openCancel(entry: TicketTimeEntryDto) {
    setCancelError(null)
    setCancelTarget(entry)
  }

  function handleConfirmCancel(reason: string) {
    if (!cancelTarget) return
    setCancelError(null)
    cancel.mutate(
      { id: cancelTarget.id, note: reason },
      {
        onSuccess: () => {
          toast.success('Apontamento cancelado.')
          setCancelTarget(null)
        },
        onError: (err) => {
          const msg = handleApiError(err)
          setCancelError(msg)
          toast.error(msg)
        },
      },
    )
  }

  function handleConfirmRestore() {
    if (!restoreTarget) return
    restore.mutate(
      { id: restoreTarget.id },
      {
        onSuccess: () => {
          toast.success('Apontamento restaurado.')
          setRestoreTarget(null)
        },
        onError: (err) => {
          toast.error(handleApiError(err))
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
                canManage={canManageEntries}
                onCancel={openCancel}
                onRestore={setRestoreTarget}
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
          canManage={modal.mode === 'edit' && canManageEntries}
          onClose={() => setModal({ open: false })}
          onRequestCancel={(e) => {
            setModal({ open: false })
            openCancel(e)
          }}
          onSubmitted={() => {
            void entriesQuery.refetch()
          }}
        />
      )}

      <CancelTimeEntryDialog
        isOpen={cancelTarget !== null}
        entryLabel={cancelTarget ? entryLabel(cancelTarget) : undefined}
        isSubmitting={cancel.isPending}
        apiError={cancelError}
        onConfirm={handleConfirmCancel}
        onClose={() => {
          if (cancel.isPending) return
          setCancelTarget(null)
          setCancelError(null)
        }}
      />

      {restoreTarget && (
        <Modal
          isOpen={restoreTarget !== null}
          size="sm"
          title="Restaurar apontamento"
          onClose={() => {
            if (restore.isPending) return
            setRestoreTarget(null)
          }}
        >
          <div className="flex flex-col gap-5">
            <p className="-mt-1 text-sm text-foreground/70">
              O tempo volta a contar nas somas. Deseja restaurar este apontamento?
              {` (${entryLabel(restoreTarget)})`}
            </p>
            <div className="flex items-center justify-between gap-3 pt-1">
              <Button
                variant="secondary"
                onClick={() => setRestoreTarget(null)}
                disabled={restore.isPending}
              >
                Voltar
              </Button>
              <Button
                variant="primary"
                onClick={handleConfirmRestore}
                isLoading={restore.isPending}
                disabled={restore.isPending}
              >
                Restaurar
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </PageWrapper>
  )
}
