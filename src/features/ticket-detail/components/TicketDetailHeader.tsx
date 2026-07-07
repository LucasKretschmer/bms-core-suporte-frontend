import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { INVOICY_CATEGORY } from '../constants'
import type { TicketHeaderDto } from '../types/ticketDetail'

type TicketDetailHeaderProps = {
  ticket: TicketHeaderDto
  canCreate: boolean
  onAddAppointment: () => void
}

function PlusIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
    </svg>
  )
}

function ExternalIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
    </svg>
  )
}

/**
 * Header do detalhe do ticket (referência protótipo L554-562).
 * #ID — assunto [status] + meta + botões (Adicionar apontamento / Acessar no HubSpot).
 * Alerta Invoicy (R10) quando a categoria HubSpot é a de análise.
 */
export function TicketDetailHeader({
  ticket,
  canCreate,
  onAddAppointment,
}: TicketDetailHeaderProps) {
  const isInvoicy = ticket.categoria === INVOICY_CATEGORY
  const solicitanteNome = ticket.requester?.nome ?? null
  const solicitanteEmail = ticket.requester?.email ?? null

  const metaParts = [
    ticket.client?.nomeFantasia ?? null,
    ticket.client?.razaoSocial ?? null,
    ticket.categoria ? `Categoria: ${ticket.categoria}` : null,
    solicitanteNome
      ? `Solicitante: ${solicitanteNome}${solicitanteEmail ? ` (${solicitanteEmail})` : ''}`
      : null,
  ].filter((p): p is string => Boolean(p))

  return (
    <section className="rounded-card border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 flex-wrap text-2xl font-semibold text-foreground">
            <span>
              #{ticket.hubspotTicketId} — {ticket.assunto ?? 'Sem assunto'}
            </span>
            {ticket.pipelineStage && <Badge value={ticket.pipelineStage} />}
          </h1>
          {metaParts.length > 0 && (
            <p className="mt-1 text-sm text-foreground/50">{metaParts.join(' · ')}</p>
          )}
        </div>

        <div className="flex gap-2 flex-wrap shrink-0">
          {canCreate && (
            <Button variant="primary" icon={<PlusIcon />} onClick={onAddAppointment}>
              Adicionar apontamento
            </Button>
          )}
          {ticket.hubspotUrl && (
            <a
              href={ticket.hubspotUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2.5 h-9 px-3 py-2.5 rounded-control font-semibold text-sm bg-card text-foreground border border-border transition-shadow duration-150 hover:shadow-hover focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
            >
              <ExternalIcon />
              <span>Acessar no HubSpot</span>
            </a>
          )}
        </div>
      </div>

      {isInvoicy && (
        <p
          role="status"
          className="mt-3 rounded-input border border-warning-fg/30 bg-warning-bg px-3 py-2 text-sm text-warning-fg"
        >
          <span className="font-semibold">
            Ticket [{INVOICY_CATEGORY}]: horas vão para análise, fora do consumo do plano.
          </span>
        </p>
      )}
    </section>
  )
}
