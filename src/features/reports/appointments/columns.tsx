/**
 * Colunas da tabela U4 — Apontamentos por Ticket.
 *
 * Whitelist de sortBy (backend): hubspotticketid, assunto, cliente, equipe, owner, status, tempo, apontamentos
 *
 * Coluna "Ticket": exibe o hubspotTicketId. Links HubSpot com rel="noopener noreferrer".
 * Tempo zero: exibido como "0h 0m" — tickets sem apontamento aparecem normalmente.
 * Status: Badge dinâmico — fallback neutro para valores desconhecidos, nunca quebra.
 */

import { Badge } from '../../../components/ui/Badge'
import type { ColumnDef } from '../../../components/ui/DataTable/types'
import type { TicketReportItemDto } from '../shared/types/reports'
import { formatSeconds } from '../shared/utils/formatters'
import { INVOICY_CATEGORY } from '../../ticket-detail/constants'

/**
 * Destaque `tomato` (107): aplicado APENAS ao badge de Status quando a categoria
 * do ticket é "Problema - Invoicy" — nunca à linha inteira. `tomato` é o named
 * color CSS (rgb(255,99,71)) escolhido explicitamente pelo usuário; exceção
 * pontual e documentada ao design system por tokens. Texto tomato + fundo
 * tomato translúcido; sobrepõe as classes de cor por token do Badge.
 */
const INVOICY_STATUS_STYLE: React.CSSProperties = {
  color: 'tomato',
  backgroundColor: 'rgba(255, 99, 71, 0.12)',
}

/**
 * Ícone de link externo — aria-hidden pois o texto do link já é descritivo.
 */
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

export function buildAppointmentsColumns(): ColumnDef<TicketReportItemDto>[] {
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
      header: 'Assunto',
      sortable: true,
      sortKey: 'assunto',
      align: 'left',
      accessor: (row) => row.assunto ?? '—',
    },
    {
      key: 'cliente',
      header: 'Cliente',
      sortable: true,
      sortKey: 'cliente',
      align: 'left',
      accessor: (row) => row.clienteNome ?? '—',
    },
    {
      key: 'equipe',
      header: 'Equipe',
      sortable: true,
      sortKey: 'equipe',
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
      // Categoria do HubSpot — exibida só na tela (nunca no export, por privacidade).
      // Não ordenável: coluna informativa; o filtro dedicado cobre a segmentação.
      key: 'categoria',
      header: 'Categoria',
      sortable: false,
      align: 'left',
      accessor: (row) => row.categoria ?? '—',
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      sortKey: 'status',
      align: 'center',
      width: '160px',
      // Status pode vir como label longo do backend (ex.: "Em atendimento (Relacionamento BR)").
      // Truncamos com reticências + tooltip (title) para não estourar a largura da coluna.
      // Destaque tomato (107): apenas o badge de Status quando categoria === Invoicy.
      accessor: (row) => {
        if (!row.status) return <span className="text-foreground/40">—</span>
        const isInvoicy = row.categoria === INVOICY_CATEGORY
        return (
          <div className="flex justify-center">
            <Badge
              value={row.status}
              truncate
              className="max-w-[140px]"
              style={isInvoicy ? INVOICY_STATUS_STYLE : undefined}
            />
          </div>
        )
      },
    },
    {
      key: 'tempo',
      header: 'Tempo',
      sortable: true,
      sortKey: 'tempo',
      align: 'right',
      width: '100px',
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
