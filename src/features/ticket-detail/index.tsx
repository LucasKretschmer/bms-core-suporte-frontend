/**
 * F3 — Tela "Detalhe do ticket" (/relatorios/tickets/$ticketId).
 *
 * Header + meta + KPIs + lista de cards de apontamento (com SegmentTimeline).
 * Criar/editar apontamento via TimeEntryModal (F4). Cancelar/restaurar (099).
 * Breadcrumb encadeado conforme a origem do drill-down (F5/R2).
 *
 * 122/A11Y-2 — esta tela abre TRÊS modais (apontamento, cancelamento, restauração) e
 * é ela, não o `Modal`, quem devolve o foco ao gatilho ao fechar (§5.3: "foco preso E
 * devolve o foco ao gatilho" são dois mecanismos com donos diferentes; ver o bloco
 * "O QUE ELE NÃO FAZ" em `components/ui/Modal.tsx`). O gatilho é capturado em
 * `hooks/useReturnFocus` (global desde 122/CONSOL-1, compartilhado com os dashboards) —
 * leia lá por que é `document.activeElement` e não um `triggerRef`.
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
import { useReturnFocus } from '../../hooks/useReturnFocus'
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

  /**
   * 122/A11Y-2 — §5.3 ("modal com foco preso E devolve o foco ao gatilho"): a
   * devolução é de quem abre o modal (ver `components/ui/Modal.tsx`). Um controlador
   * por modal, porque cada um tem gatilhos próprios e podem se encadear.
   */
  const timeEntryFocus = useReturnFocus()
  const cancelFocus = useReturnFocus()
  const restoreFocus = useReturnFocus()

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

  /** Abre o modal de apontamento guardando o gatilho (header, empty state ou card). */
  function openCreate() {
    timeEntryFocus.capture()
    setModal({ open: true, mode: 'create' })
  }

  function openEdit(entry: TicketTimeEntryDto) {
    timeEntryFocus.capture()
    setModal({ open: true, mode: 'edit', entry })
  }

  function closeTimeEntryModal() {
    setModal({ open: false })
    timeEntryFocus.restore()
  }

  function openCancel(entry: TicketTimeEntryDto) {
    cancelFocus.capture()
    setCancelError(null)
    setCancelTarget(entry)
  }

  function closeCancel() {
    setCancelTarget(null)
    setCancelError(null)
    cancelFocus.restore()
  }

  function openRestore(entry: TicketTimeEntryDto) {
    restoreFocus.capture()
    setRestoreTarget(entry)
  }

  function closeRestore() {
    setRestoreTarget(null)
    restoreFocus.restore()
  }

  function handleConfirmCancel(reason: string) {
    if (!cancelTarget) return
    setCancelError(null)
    // 120/D-1: mesma mutation/endpoint — o servidor decide CANCELLED (sem tempo) vs
    // DISCARDED (com tempo consolidado). O toast reflete o resultado esperado usando o
    // mesmo totalSeconds já calculado antes do submit (a mutation não retorna o status novo).
    const wasDiscarded = cancelTarget.totalSeconds > 0
    cancel.mutate(
      { id: cancelTarget.id, note: reason },
      {
        onSuccess: () => {
          toast.success(wasDiscarded ? 'Apontamento descartado.' : 'Apontamento cancelado.')
          // Fecha pelo MESMO caminho do "X"/"Voltar" — devolver o foco não é privilégio
          // do cancelamento do fluxo, vale para toda saída do modal.
          closeCancel()
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
          closeRestore()
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
          <div className="rounded-card border border-border bg-card p-4">
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
            onAddAppointment={openCreate}
          />
        )}

        {/* KPIs (dependem da lista) */}
        {!entriesQuery.isLoading && !entriesQuery.isError && (
          <TicketKpiSummary entries={entries} />
        )}

        {/* Lista de apontamentos */}
        <section aria-label="Apontamentos do ticket" className="flex flex-col gap-3">
          {entriesQuery.isLoading && (
            <div className="rounded-card border border-border bg-card p-4">
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
                onClick: openCreate,
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
                onEdit={openEdit}
                canManage={canManageEntries}
                onCancel={openCancel}
                onRestore={openRestore}
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
          onClose={closeTimeEntryModal}
          onRequestCancel={(e) => {
            // Encadeamento: o gatilho que abriu ESTE modal (ex.: "editar" do card)
            // continua sendo o dono do foco — o botão de dentro do modal some junto
            // com ele. Sem a transferência, o diálogo de cancelamento fecharia sem ter
            // para onde devolver o foco. `openCancel` não é usado aqui de propósito:
            // ele capturaria o botão que está prestes a ser desmontado.
            cancelFocus.adopt(timeEntryFocus.release())
            setModal({ open: false })
            setCancelError(null)
            setCancelTarget(e)
          }}
          onSubmitted={() => {
            void entriesQuery.refetch()
          }}
        />
      )}

      <CancelTimeEntryDialog
        isOpen={cancelTarget !== null}
        entryLabel={cancelTarget ? entryLabel(cancelTarget) : undefined}
        hasConsolidatedTime={cancelTarget ? cancelTarget.totalSeconds > 0 : false}
        isSubmitting={cancel.isPending}
        apiError={cancelError}
        onConfirm={handleConfirmCancel}
        onClose={() => {
          if (cancel.isPending) return
          closeCancel()
        }}
      />

      {restoreTarget && (
        <Modal
          isOpen={restoreTarget !== null}
          size="sm"
          title="Restaurar apontamento"
          onClose={() => {
            if (restore.isPending) return
            closeRestore()
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
                onClick={closeRestore}
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
