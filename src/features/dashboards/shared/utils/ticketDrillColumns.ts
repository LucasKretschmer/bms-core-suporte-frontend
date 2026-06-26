/**
 * Colunas da tabela de drill-down da família TICKET, por `metric`.
 *
 * Função pura (testável): dado o metric, devolve o ColumnDef apropriado.
 * Base comum (ticket, assunto, cliente, equipe, status) + colunas específicas do KPI
 * (datas/tempos/sla/csat/fcr). NUNCA expõe categoria HubSpot (AP-SECURITY-001) — `status`
 * é o label do pipeline resolvido pelo backend.
 *
 * `sortKey` reflete a whitelist de ordenação do backend (lowercase do campo do DTO).
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
  header: '1ª resposta (corridas)',
  accessor: (row) => fmtHours(row.frHoras),
  align: 'right',
}

const colFrHorasUteis: ColumnDef<TicketRowDto> = {
  key: 'frHorasUteis',
  header: '1ª resposta (úteis)',
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
  header: 'SLA 1ª resposta',
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

/** Devolve o conjunto de colunas para o metric da família ticket. */
export function ticketDrillColumns(metric: TicketMetricKey): ColumnDef<TicketRowDto>[] {
  return [...baseCols, ...extraColsByMetric[metric]]
}
