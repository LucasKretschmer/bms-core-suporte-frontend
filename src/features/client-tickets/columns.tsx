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
 *
 * 123/FAT-1 — quatro colunas novas, todas de campos que o backend JÁ emitia e o painel
 * descartava (grep de `fechadoEm`/`faturaPlanoSegundos` em `src/` dava zero usos fora dos
 * tipos):
 *   · "Concluído em"  (`fechadoEm`)              — a data que decide a competência de fatura;
 *   · "Plano (chamado)" / "Cobrado por fora (chamado)" / "Análise (chamado)"
 *     (`faturaPlanoSegundos` / `faturaFaturadoSegundos` / `faturaAnaliseSegundos`) — os 3
 *     baldes ALL-TIME do chamado, que são o que compõe a fatura.
 * Nenhuma é sortável: `fechadoem` e os baldes NÃO estão na whitelist de `sortBy` de
 * `/reports/tickets` (`ReportQueryRepository.cs:1044-1113`) — o backend cairia no default e
 * a seta mentiria, exatamente como já documentado em "Na fatura".
 */

/**
 * 125/FE-A11Y-3 (`A-1`) — o travessão de célula vazia (`—`) era `text-foreground/40`:
 * **2,34:1** sobre `--color-card` (#ffffff), pouco mais de metade do piso AA (4,5:1).
 * Ele NÃO é decorativo — não é `aria-hidden` e os `headerInfo` desta tabela o DEFINEM
 * como "informação não disponível", ou seja, ele carrega significado e é texto para a
 * WCAG 1.4.3. `text-foreground/70` mede **5,47:1** sobre o card e 5,20:1 sobre a
 * página, e mantém a célula vazia visualmente secundária.
 */
import { Badge } from '../../components/ui/Badge'
import { ExternalLinkIcon } from '../../components/ui/ExternalLinkIcon'
import type { ColumnDef } from '../../components/ui/DataTable/types'
import type { ClientTicketItemDto } from './types/clientTickets'
import { formatDate, formatSeconds } from '../reports/shared/utils/formatters'
import { NA_FATURA_CLASSES } from '../reports/shared/utils/faturamentoTheme'
import {
  HEADER_BALDE_ANALISE,
  HEADER_BALDE_FATURADO,
  HEADER_BALDE_PLANO,
  HEADER_CONCLUIDO_EM,
  TOOLTIP_BALDE_ANALISE,
  TOOLTIP_BALDE_FATURADO,
  TOOLTIP_BALDE_PLANO,
  TOOLTIP_CONCLUIDO_EM,
} from '../reports/shared/utils/competenciaTexts'

/** Rótulo da coluna de tempo — ver o comentário do cabeçalho (121/§4.4). */
export const HEADER_TEMPO_NO_PERIODO = 'Tempo no período'

/**
 * 123/FAT-1 — formatação dos 3 baldes de fatura do chamado.
 *
 * TRÊS ramos, não dois (AP-FRONTEND-021/028). Os campos são `long` não-anuláveis no DTO
 * (`ReportsDtos.cs:267-269`, default `0`), logo o backend NOVO sempre manda um número —
 * mas o backend ANTIGO não manda a chave, e `formatSeconds(undefined)` escreveria
 * **"0h 0m"**, afirmando "nenhuma hora neste balde" onde o valor é DESCONHECIDO. `== null`
 * cobre as duas formas de ausência do wire.
 */
export function baldeTexto(segundos: number | null | undefined): string {
  if (segundos == null) return '—'
  return formatSeconds(segundos)
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
          <span className="text-foreground/70">—</span>
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
        'Tempo total dos apontamentos com início no período filtrado — todos os tipos de faturamento, não apenas o plano. Esta NÃO é a data que decide a fatura: para isso veja "Concluído em".',
      sortable: true,
      sortKey: 'tempo',
      align: 'right',
      width: '130px',
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
    {
      /**
       * 123/FAT-1 — "Concluído em": `Ticket.FechadoEm` em ISO-8601
       * (`ReportQueryRepository.cs:1263` → `r.FechadoEm?.ToString("o")`).
       *
       * É o campo que EXPLICA o relato do QA: um apontamento de 20/07 numa fatura de agosto
       * deixa de ser inexplicável quando a linha mostra que o chamado fechou em agosto.
       *
       * ⚠️ Guard `== null`, não `=== undefined` (AP-FRONTEND-028): a chave tem DUAS formas de
       * ausência no wire — o backend serializa com `DefaultIgnoreCondition =
       * WhenWritingNull` (`Program.cs:107-108`), então chamado sem data de conclusão vem como
       * chave AUSENTE; um serializador diferente mandaria `null`. Os dois significam
       * "chamado sem data de conclusão" e os dois têm de cair em "—".
       */
      key: 'concluidoEm',
      header: HEADER_CONCLUIDO_EM,
      headerInfo: TOOLTIP_CONCLUIDO_EM,
      align: 'center',
      width: '120px',
      accessor: (row) =>
        row.fechadoEm == null ? (
          <span className="text-foreground/70">—</span>
        ) : (
          formatDate(row.fechadoEm)
        ),
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
          return <span className="text-foreground/70">—</span>
        }
        return row.entraNaFatura ? (
          <Badge value="Sim" className={NA_FATURA_CLASSES.sim} />
        ) : (
          <Badge value="Não" className={NA_FATURA_CLASSES.nao} />
        )
      },
    },
    {
      key: 'baldePlano',
      header: HEADER_BALDE_PLANO,
      headerInfo: TOOLTIP_BALDE_PLANO,
      align: 'right',
      width: '130px',
      accessor: (row) => baldeTexto(row.faturaPlanoSegundos),
    },
    {
      key: 'baldeFaturado',
      header: HEADER_BALDE_FATURADO,
      headerInfo: TOOLTIP_BALDE_FATURADO,
      align: 'right',
      width: '150px',
      accessor: (row) => baldeTexto(row.faturaFaturadoSegundos),
    },
    {
      key: 'baldeAnalise',
      header: HEADER_BALDE_ANALISE,
      headerInfo: TOOLTIP_BALDE_ANALISE,
      align: 'right',
      width: '140px',
      accessor: (row) => baldeTexto(row.faturaAnaliseSegundos),
    },
  ]
}
