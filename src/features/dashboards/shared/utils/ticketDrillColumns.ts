/**
 * Colunas da tabela de drill-down da família TICKET, por `metric`.
 *
 * Função pura (testável): dado o metric, devolve o ColumnDef apropriado.
 * Base comum (ticket, assunto, cliente, equipe, status) + colunas específicas do KPI
 * (datas/tempos/sla/csat/fcr). NUNCA expõe categoria HubSpot (AP-SECURITY-001) — `status`
 * é o label do pipeline resolvido pelo backend.
 *
 * `sortKey` reflete a whitelist de ordenação do backend (lowercase do campo do DTO).
 *
 * ## 124/P-7 — estes `header` também são os cabeçalhos do EXPORT
 *
 * `MetricDrillModal` monta `exportCols` a partir de `c.header`, então o CSV/XLSX sai com
 * exatamente estas palavras. É o quarto lugar de AP-FRONTEND-028 — e o mais grave, porque
 * planilha errada o gestor encaminha em vez de recarregar. Por isso "1ª resposta" foi
 * trocado por "1º atendimento" aqui junto com o resto (`decisoes.md` § `P-7`): o que a
 * coluna mede é o tempo até o **primeiro apontamento**, não até a resposta ao cliente.
 *
 * As `key` (`frHoras`, `frHorasUteis`, `frSla`) **não** mudam: são campos de `TicketRowDto`
 * e chaves de ordenação do backend.
 */

import { formatDate, formatHours, formatDecimal } from '../../../reports/shared/utils/formatters'
import type { ColumnDef } from '../../../../components/ui/DataTable/types'
import type { TicketMetricKey, TicketRowDto } from '../types/metrics'

function fmtDate(iso: string | null): string {
  return iso ? formatDate(iso) : '—'
}

function fmtHours(v: number | null): string {
  return v === null || v === undefined ? '—' : formatHours(v)
}

/** Traduz o valor cru de FrSla do backend ('MET'/'MISSED') para rótulo em português. */
function fmtSla(v: string | null): string {
  if (v === 'MET') return 'No prazo'
  if (v === 'MISSED') return 'Fora do prazo'
  return '—'
}

function fmtCsat(v: number | null): string {
  return v === null || v === undefined ? '—' : formatDecimal(v)
}

function fmtFcr(v: boolean | null): string {
  if (v === null || v === undefined) return '—'
  return v ? 'Sim' : 'Não'
}

// ── Colunas reutilizáveis ─────────────────────────────────────────────────────

const colTicket: ColumnDef<TicketRowDto> = {
  key: 'hubspotTicketId',
  header: 'Ticket',
  accessor: (row) => `#${row.hubspotTicketId}`,
  sortable: true,
  sortKey: 'hubspotticketid',
  align: 'left',
}

const colAssunto: ColumnDef<TicketRowDto> = {
  key: 'assunto',
  header: 'Assunto',
  accessor: (row) => row.assunto ?? '—',
  align: 'left',
}

const colCliente: ColumnDef<TicketRowDto> = {
  key: 'clienteNome',
  header: 'Cliente',
  accessor: (row) => row.clienteNome ?? '—',
  // Ordenação de SERVIDOR (123/D1): `cliente` está na whitelist da família ticket
  // (MetricsQueryRepository.GetTicketRowsAsync → case "cliente" → Client.NomeFantasia,
  // com desempate estável por PK). Sem `sortable` a DataTable não desenha o botão
  // (`canSort = sortable && sortKey`) e a coluna não ordena de jeito nenhum — não há
  // ordenação em memória nas tabelas de drill.
  sortable: true,
  sortKey: 'cliente',
  align: 'left',
}

const colEquipe: ColumnDef<TicketRowDto> = {
  key: 'equipe',
  header: 'Equipe',
  accessor: (row) => row.equipe ?? '—',
  align: 'left',
}

const colStatus: ColumnDef<TicketRowDto> = {
  key: 'status',
  header: 'Status',
  accessor: (row) => row.status ?? '—',
  align: 'left',
}

const colAberto: ColumnDef<TicketRowDto> = {
  key: 'hsCriadoEm',
  header: 'Aberto em',
  accessor: (row) => fmtDate(row.hsCriadoEm),
  sortable: true,
  sortKey: 'hscriadoem',
  align: 'center',
}

const colFechado: ColumnDef<TicketRowDto> = {
  key: 'fechadoEm',
  header: 'Resolvido em',
  accessor: (row) => fmtDate(row.fechadoEm),
  sortable: true,
  sortKey: 'fechadoem',
  align: 'center',
}

const colReaberto: ColumnDef<TicketRowDto> = {
  key: 'reabertoEm',
  header: 'Reaberto em',
  accessor: (row) => fmtDate(row.reabertoEm),
  sortable: true,
  sortKey: 'reabertoem',
  align: 'center',
}

const colFrHoras: ColumnDef<TicketRowDto> = {
  key: 'frHoras',
  header: '1º atendimento (corridas)',
  accessor: (row) => fmtHours(row.frHoras),
  align: 'right',
}

const colFrHorasUteis: ColumnDef<TicketRowDto> = {
  key: 'frHorasUteis',
  header: '1º atendimento (úteis)',
  accessor: (row) => fmtHours(row.frHorasUteis),
  align: 'right',
}

const colResHoras: ColumnDef<TicketRowDto> = {
  key: 'resHoras',
  header: 'Resolução (corridas)',
  accessor: (row) => fmtHours(row.resHoras),
  align: 'right',
}

const colResHorasUteis: ColumnDef<TicketRowDto> = {
  key: 'resHorasUteis',
  header: 'Resolução (úteis)',
  accessor: (row) => fmtHours(row.resHorasUteis),
  align: 'right',
}

const colSla: ColumnDef<TicketRowDto> = {
  key: 'frSla',
  header: 'SLA 1º atendimento',
  accessor: (row) => fmtSla(row.frSla),
  align: 'center',
}

const colCsat: ColumnDef<TicketRowDto> = {
  key: 'csat',
  header: 'CSAT',
  accessor: (row) => fmtCsat(row.csat),
  align: 'right',
}

const colFcr: ColumnDef<TicketRowDto> = {
  key: 'isOneTouch',
  header: 'Resolvido no 1º contato',
  accessor: (row) => fmtFcr(row.isOneTouch),
  align: 'center',
}

const baseCols: ColumnDef<TicketRowDto>[] = [
  colTicket,
  colAssunto,
  colCliente,
  colEquipe,
  colStatus,
]

/** Mapa metric → colunas extras (além das base). */
const extraColsByMetric: Record<TicketMetricKey, ColumnDef<TicketRowDto>[]> = {
  'tickets-backlog': [colAberto],
  'tickets-abertos': [colAberto],
  'tickets-resolvidos': [colAberto, colFechado],
  'tickets-reabertos': [colAberto, colReaberto],
  'tickets-tempos': [colFrHoras, colFrHorasUteis, colResHoras, colResHorasUteis],
  'tickets-sla': [colAberto, colSla],
  'tickets-csat': [colFechado, colCsat],
  'tickets-fcr': [colFechado, colFcr],
}

/**
 * Todas as métricas da família ticket que abrem tabela de drill.
 *
 * DERIVADO em runtime do próprio mapa de colunas (`extraColsByMetric`, tipado como
 * `Record<TicketMetricKey, …>` — o compilador exige exaustividade). Serve de universo
 * para os invariantes de coluna/ordenação nos testes: métrica nova entra aqui sozinha,
 * sem lista paralela mantida à mão.
 */
export const TICKET_DRILL_METRICS = Object.keys(extraColsByMetric) as TicketMetricKey[]

/** Devolve o conjunto de colunas para o metric da família ticket. */
export function ticketDrillColumns(metric: TicketMetricKey): ColumnDef<TicketRowDto>[] {
  return [...baseCols, ...extraColsByMetric[metric]]
}
