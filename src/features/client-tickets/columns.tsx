/**
 * Colunas da tabela "Tickets do cliente" (F2).
 *
 * Reusa TicketReportItemDto (B1). Os campos disponíveis no DTO são a fonte de
 * verdade — não inventar colunas (solicitante/categoria HubSpot/% não vêm neste DTO).
 * Esta é a visão interna de drill-down (R5): mostrar dados internos do ticket é OK.
 *
 * Whitelist de sortBy (backend, mesma de /reports/tickets):
 *   hubspotticketid, assunto, cliente, owner, status, tempo, apontamentos
 *
 * Coluna "Ticket": link HubSpot com rel="noopener noreferrer" + stopPropagation.
 */

import { Badge } from '../../components/ui/Badge'
import type { ColumnDef } from '../../components/ui/DataTable/types'
import type { ClientTicketItemDto } from './types/clientTickets'
import { formatSeconds } from '../reports/shared/utils/formatters'

function ExternalLinkIcon() {
  return (
    <svg
      aria-hidden="true"
      className="inline-block ml-1 h-3 w-3 text-foreground/50 shrink-0"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
      />
    </svg>
  )
}

export function buildClientTicketsColumns(): ColumnDef<ClientTicketItemDto>[] {
  return [
    {
      key: 'ticket',
      header: 'Ticket',
      sortable: true,
      sortKey: 'hubspotticketid',
      align: 'left',
      width: '120px',
      accessor: (row) => {
        if (row.hubspotUrl) {
          return (
            <a
              href={row.hubspotUrl}
              target="_blank"
              rel="noopener noreferrer"
              title={`Abrir ticket ${row.hubspotTicketId} no HubSpot`}
              className="inline-flex items-center text-primary hover:underline focus-visible:ring-2 focus-visible:ring-primary rounded"
              onClick={(e) => e.stopPropagation()}
            >
              #{row.hubspotTicketId}
              <ExternalLinkIcon />
            </a>
          )
        }
        return <span>#{row.hubspotTicketId}</span>
      },
    },
    {
      key: 'assunto',
      header: 'Nome do ticket',
      sortable: true,
      sortKey: 'assunto',
      align: 'left',
      accessor: (row) => row.assunto ?? '—',
    },
    {
      key: 'equipe',
      header: 'Equipe',
      sortable: false,
      align: 'left',
      accessor: (row) => row.equipe ?? '—',
    },
    {
      key: 'owner',
      header: 'Atendente',
      sortable: true,
      sortKey: 'owner',
      align: 'left',
      accessor: (row) => row.ownerNome ?? '—',
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      sortKey: 'status',
      align: 'center',
      width: '160px',
      accessor: (row) =>
        row.status ? (
          <Badge value={row.status} />
        ) : (
          <span className="text-foreground/40">—</span>
        ),
    },
    {
      key: 'tempo',
      header: 'Tempo do plano',
      sortable: true,
      sortKey: 'tempo',
      align: 'right',
      width: '120px',
      accessor: (row) => formatSeconds(row.totalSeconds),
    },
    {
      key: 'apontamentos',
      header: 'Apontamentos',
      sortable: true,
      sortKey: 'apontamentos',
      align: 'right',
      width: '130px',
      accessor: (row) => row.apontamentosCount,
    },
  ]
}
