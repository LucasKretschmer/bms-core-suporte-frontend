/**
 * Colunas da tabela de exceções de faturamento (121/A2, §5.2).
 *
 * Whitelist de `sortBy` do backend (§5.2 — `switch` explícito, nada arbitrário):
 *   hubspotticketid | cliente | equipe | owner | status | ultimaatividade | segundos
 * Coluna sem `sortKey` nessa lista **não** é sortável — o backend cairia no default
 * em silêncio e a seta da tabela mentiria.
 *
 * NUNCA há coluna de categoria do HubSpot aqui: o balde Análise é comunicado por
 * `segundosAnalise` (AP-SECURITY-001 / §5.2).
 *
 * 121/F7 — o CONJUNTO de colunas é o mesmo nas duas abas (AP-ARQUITETURA-005), mas o
 * cabeçalho da coluna de horas depende da seção: `tipo` é parâmetro obrigatório porque
 * "Horas presas" é uma afirmação verdadeira só na aba acionável.
 */

/**
 * 125/FE-A11Y-3 (`A-1`) — o travessão de célula vazia (`—`) era `text-foreground/40`:
 * **2,34:1** sobre `--color-card` (#ffffff), pouco mais de metade do piso AA (4,5:1).
 * Ele NÃO é decorativo — não é `aria-hidden` e os `headerInfo` desta tabela o DEFINEM
 * como "informação não disponível", ou seja, ele carrega significado e é texto para a
 * WCAG 1.4.3. `text-foreground/70` mede **5,47:1** sobre o card e 5,20:1 sobre a
 * página, e mantém a célula vazia visualmente secundária.
 */
import { Badge } from '../../../../components/ui/Badge'
import { ExternalLinkIcon } from '../../../../components/ui/ExternalLinkIcon'
import type { ColumnDef } from '../../../../components/ui/DataTable/types'
import type {
  BillingExceptionItemDto,
  BillingExceptionTipo,
} from '../../shared/types/reports'
import { formatDateTime, formatSeconds } from '../../shared/utils/formatters'
import { TEXTO_COLUNA_HORAS } from '../billingExceptionsTexts'

/** Whitelist do backend — exportada para o teste travar a identidade do conjunto. */
export const BILLING_EXCEPTIONS_SORT_WHITELIST = [
  'hubspotticketid',
  'cliente',
  'equipe',
  'owner',
  'status',
  'ultimaatividade',
  'segundos',
] as const

export function buildBillingExceptionsColumns(
  tipo: BillingExceptionTipo,
): ColumnDef<BillingExceptionItemDto>[] {
  return [
    {
      key: 'ticket',
      header: 'Ticket',
      sortable: true,
      sortKey: 'hubspotticketid',
      align: 'left',
      width: '120px',
      accessor: (row) =>
        row.hubspotUrl ? (
          <a
            href={row.hubspotUrl}
            target="_blank"
            rel="noopener noreferrer"
            title={`Abrir ticket ${row.hubspotTicketId} no HubSpot`}
            className="inline-flex items-center text-primary hover:underline focus-visible:ring-2 focus-visible:ring-primary rounded"
          >
            #{row.hubspotTicketId}
            <ExternalLinkIcon />
          </a>
        ) : (
          <span>#{row.hubspotTicketId}</span>
        ),
    },
    {
      key: 'assunto',
      header: 'Nome do ticket',
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
      key: 'status',
      header: 'Status',
      sortable: true,
      sortKey: 'status',
      align: 'center',
      width: '170px',
      accessor: (row) =>
        row.status ? (
          <Badge value={row.status} truncate className="max-w-[150px]" />
        ) : (
          <span className="text-foreground/70">—</span>
        ),
    },
    {
      key: 'ultimaAtividade',
      header: 'Última atividade',
      headerInfo: 'Data do apontamento mais recente do chamado. "—" = nenhum apontamento.',
      sortable: true,
      sortKey: 'ultimaatividade',
      align: 'left',
      width: '150px',
      accessor: (row) =>
        row.ultimaAtividadeEm ? formatDateTime(row.ultimaAtividadeEm) : '—',
    },
    {
      key: 'segundos',
      // 121/F7 — rótulo e explicação por seção: "Horas presas" só na aba acionável.
      header: TEXTO_COLUNA_HORAS[tipo].header,
      headerInfo: TEXTO_COLUNA_HORAS[tipo].info,
      sortable: true,
      sortKey: 'segundos',
      align: 'right',
      width: '120px',
      accessor: (row) => formatSeconds(row.segundosTotais),
    },
  ]
}
