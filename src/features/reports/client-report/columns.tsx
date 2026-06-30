/**
 * Colunas da tabela U5 — Relatório do Cliente.
 *
 * PRIVACIDADE (regra central do PRD):
 *   - A categoria do chamado do HubSpot (ex: "Problema - Invoicy") NUNCA aparece.
 *   - O DTO ClientReportItemDto NÃO contém esse campo — garantia em tempo de tipo.
 *   - "Categorização do atendimento" = ServiceCategory interna (ex: Consultoria, Plantão)
 *     — campo diferente e seguro para enviar ao cliente.
 *   - "Faturamento" abstrai a categoria interna (3 status: Não faturado / Faturado / Plano de Suporte).
 *
 * Nota sobre "Serviço" e "Serviço - Secundário":
 *   - O DTO atual não contém campos `servico` / `servico__secundario` do HubSpot.
 *   - TODO (Manager): quando o backend expor esses campos no ClientReportItemDto,
 *     adicionar as colunas aqui. Por ora, exibimos um placeholder "—" comentado.
 *
 * Whitelist de sortBy (backend, GET /reports/client format=rows): inicioem, totalsegundos, hubspotticketid.
 * Colunas fora dessa whitelist ficam sortable:false (não forjamos sort client-side — 053).
 */

import { Badge } from '../../../components/ui/Badge'
import type { ColumnDef } from '../../../components/ui/DataTable/types'
import type { ClientReportItemDto } from '../shared/types/reports'
import { formatDate, formatDateTime, formatSeconds } from '../shared/utils/formatters'

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

type BuildColumnsOptions = {
  /** Se true, a linha inteira é clicável — o link da coluna Ticket fica como fallback textual */
  rowIsClickable?: boolean
  /** Mapa de ticketId → hubspotUrl para abertura de links ao clicar na linha */
  getHubspotUrl?: (row: ClientReportItemDto) => string | null
}

export function buildClientReportColumns(
  opts: BuildColumnsOptions = {},
): ColumnDef<ClientReportItemDto>[] {
  return [
    // ── Coluna 1: Ticket ──────────────────────────────────────────────────────
    {
      key: 'ticket',
      header: 'Ticket',
      sortable: true,
      sortKey: 'hubspotticketid',
      align: 'left',
      width: '100px',
      accessor: (row) => {
        const url = opts.getHubspotUrl?.(row) ?? null
        if (url && !opts.rowIsClickable) {
          return (
            <a
              href={url}
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

    // ── Coluna 2: Nome do ticket ──────────────────────────────────────────────
    // 053: backend (GET /reports/client, format=rows) só aceita sortBy
    // inicioem | totalsegundos | hubspotticketid. 'assunto' NÃO está na whitelist,
    // então a ordenação caía silenciosamente no default. Mantemos sortable:false
    // até o backend adicionar 'assunto' (gap reportado no handoff 053).
    {
      key: 'assunto',
      header: 'Nome do ticket',
      sortable: false,
      align: 'left',
      accessor: (row) => row.assunto ?? '—',
    },

    // ── Coluna 3: Equipe ──────────────────────────────────────────────────────
    // Não sortável — campo não exposto com chave de sort no backend
    {
      key: 'equipe',
      header: 'Equipe',
      sortable: false,
      align: 'left',
      accessor: (row) => row.equipeAtribuida ?? '—',
    },

    // ── Coluna 4: Serviço ─────────────────────────────────────────────────────
    // TODO (Manager): o campo `servico` (propriedade HubSpot) não está no DTO atual.
    // Quando o backend expor ClientReportItemDto.servico, substituir o accessor abaixo.
    // Por ora, exibe categorizacaoAtendimento como aproximação mais próxima disponível.
    {
      key: 'servico',
      header: 'Serviço',
      sortable: false,
      align: 'left',
      accessor: (row) => row.categorizacaoAtendimento ?? '—',
    },

    // ── Coluna 5: Serviço - Secundário ────────────────────────────────────────
    // TODO (Manager): o campo `servico__secundario` (propriedade HubSpot) não está no DTO atual.
    // Quando o backend expor ClientReportItemDto.servicoSecundario, substituir abaixo.
    // Por ora, exibe placeholder "—" para manter a coluna na posição correta.
    {
      key: 'servicoSecundario',
      header: 'Serviço - Secundário',
      sortable: false,
      align: 'left',
      accessor: () => '—',
    },

    // ── Coluna 6: Solicitante ──────────────────────────────────────────────────
    {
      key: 'solicitante',
      header: 'Solicitante',
      sortable: false,
      align: 'left',
      accessor: (row) => row.solicitante?.nome ?? '—',
    },

    // ── Coluna 7: Atendente ───────────────────────────────────────────────────
    {
      key: 'atendente',
      header: 'Atendente',
      sortable: false,
      align: 'left',
      accessor: (row) => row.atendente || '—',
    },

    // ── Coluna 8: Categorização do atendimento ───────────────────────────────
    // ATENÇÃO: este campo é a ServiceCategory INTERNA (Consultoria, Treinamento, etc.)
    // É DIFERENTE da categoria do HubSpot ("Problema - Invoicy" etc.) que NUNCA aparece.
    {
      key: 'categorizacaoAtendimento',
      header: 'Categorização do atendimento',
      sortable: false,
      align: 'left',
      accessor: (row) => row.categorizacaoAtendimento ?? '—',
    },

    // ── Coluna 9: Faturamento ─────────────────────────────────────────────────
    // Abstrai a categoria interna do HubSpot com 3 status seguros para o cliente.
    // O campo `faturamento` é tipado como FaturamentoStatus — nunca vaza a categoria.
    {
      key: 'faturamento',
      header: 'Faturamento',
      sortable: false,
      align: 'center',
      width: '160px',
      accessor: (row) => (
        <Badge
          value={row.faturamento}
          aria-label={`Faturamento: ${row.faturamento}`}
        />
      ),
    },

    // ── Coluna 10: Abertura do chamado ─────────────────────────────────────────
    {
      key: 'aberturaChamado',
      header: 'Abertura do chamado',
      sortable: true,
      sortKey: 'inicioem',
      align: 'center',
      width: '130px',
      accessor: (row) => formatDate(row.aberturaDosChamado),
    },

    // ── Coluna 11: Data do apontamento ─────────────────────────────────────────
    {
      key: 'dataApontamento',
      header: 'Data do apontamento',
      sortable: true,
      sortKey: 'inicioem',
      align: 'center',
      width: '150px',
      accessor: (row) => formatDateTime(row.dataApontamento),
    },

    // ── Coluna 12: Tempo ────────────────────────────────────────────────────────
    {
      key: 'tempo',
      header: 'Tempo',
      sortable: true,
      sortKey: 'totalsegundos',
      align: 'right',
      width: '90px',
      accessor: (row) => formatSeconds(row.totalSegundos),
    },
  ]
}
