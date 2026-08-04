/**
 * Colunas da tabela "Tickets do cliente" (F2).
 *
 * Reusa TicketReportItemDto (B1). Os campos disponíveis no DTO são a fonte de
 * verdade — não inventar colunas (solicitante/categoria HubSpot/% não vêm neste DTO).
 * Esta é a visão interna de drill-down (R5): mostrar dados internos do ticket é OK.
 *
 * Whitelist de sortBy (backend, mesma de /reports/tickets):
 *   hubspotticketid, assunto, cliente, equipe, owner, status, tempo, apontamentos
 *
 * Coluna "Ticket": link HubSpot com rel="noopener noreferrer" + stopPropagation.
 */

import { Badge } from '../../components/ui/Badge'
import { ExternalLinkIcon } from '../../components/ui/ExternalLinkIcon'
import type { ColumnDef } from '../../components/ui/DataTable/types'
import type { ClientTicketItemDto } from './types/clientTickets'
import { formatSeconds } from '../reports/shared/utils/formatters'
import { NA_FATURA_CLASSES } from '../reports/shared/utils/faturamentoTheme'

/** Rótulo da coluna de tempo — ver o comentário do cabeçalho (121/§4.4). */
export const HEADER_TEMPO_NO_PERIODO = 'Tempo no período'

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
      // 053: /reports/tickets aceita sortBy=equipe (ordena pela equipe primária do owner).
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
      /**
       * 121/§4.4 — renomeada de "Tempo do plano" para "Tempo no período".
       *
       * O rótulo antigo AFIRMAVA algo que a coluna não mede: o valor é
       * `totalSeconds`, o tempo TOTAL dos apontamentos com início no período
       * filtrado — todos os baldes, não só o do plano de suporte. O tempo por balde
       * de fatura são campos distintos (`faturaPlanoSegundos` &c.) e não estão
       * nesta coluna. AP-FRONTEND-022: rótulo é asserção, não copy.
       */
      key: 'tempo',
      header: HEADER_TEMPO_NO_PERIODO,
      headerInfo:
        'Tempo total dos apontamentos com início no período filtrado — todos os tipos de faturamento, não apenas o plano.',
      sortable: true,
      sortKey: 'tempo',
      align: 'right',
      width: '130px',
      accessor: (row) => formatSeconds(row.totalSeconds),
    },
    {
      /**
       * 121/§4.4 — "Na fatura": `entraNaFatura` (calculado no backend como
       * `FechadoEm != null && FechadoEm ∈ [from, toExclusive)`).
       *
       * NÃO é sortável: `nafatura` não está na whitelist de `sortBy` de
       * `/reports/tickets` — o backend cairia no default e a seta mentiria.
       *
       * TRÊS ramos, não dois (AP-FRONTEND-021): campo AUSENTE = o backend ainda não
       * expõe (FAT-3 não subiu) ⇒ "—", nunca "Não". Renderizar "Não" para campo
       * ausente afirmaria que o chamado está fora da fatura.
       *
       * ⚠️ O guard é `== null`, não `=== undefined` (121/F4): "ausente" tem duas formas
       * na fronteira HTTP e não controlamos o serializador do outro lado — um `bool?`
       * no DTO manda `null`, e `null === undefined` é `false`, então a tela caía no
       * ramo `false` e afirmava "Não" para dado desconhecido.
       */
      key: 'naFatura',
      header: 'Na fatura',
      headerInfo:
        'Sim = o chamado tem data de conclusão dentro do período, então as horas dele entram na fatura desta competência. Não = ainda em aberto ou fechado em outra competência. "—" = informação ainda não disponível.',
      align: 'center',
      width: '110px',
      accessor: (row) => {
        if (row.entraNaFatura == null) {
          return <span className="text-foreground/40">—</span>
        }
        return row.entraNaFatura ? (
          <Badge value="Sim" className={NA_FATURA_CLASSES.sim} />
        ) : (
          <Badge value="Não" className={NA_FATURA_CLASSES.nao} />
        )
      },
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
