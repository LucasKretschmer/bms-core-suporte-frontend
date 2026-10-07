import { createElement } from 'react'
import type { ColumnDef } from '../../../components/ui/DataTable/types'
import type { ProductivityReportItemDto } from '../shared/types/reports'
import { formatSeconds } from '../shared/utils/formatters'
import { AnalistaCell } from './components/AnalistaCell'
import {
  VALOR_AUSENTE,
  formatNumeroOpcional,
  formatSegundosOpcional,
} from './productivityFormat'

/**
 * Colunas da Produtividade por Analista. `sortKey` segue a whitelist do backend.
 * O default de ordenação (totalsegundos desc) mora em useProductivity.
 */
export const productivityColumns: ColumnDef<ProductivityReportItemDto>[] = [
  {
    key: 'nome',
    header: 'Analista',
    sortable: true,
    sortKey: 'nome',
    align: 'left',
    accessor: (row) =>
      row.extrapolouJornada === true ? createElement(AnalistaCell, { row }) : row.nome,
  },
  {
    key: 'equipe',
    header: 'Equipe',
    sortable: true,
    sortKey: 'equipe',
    align: 'left',
    accessor: (row) => row.equipe ?? VALOR_AUSENTE,
  },
  {
    key: 'nAtendimentos',
    header: 'Atendimentos',
    sortable: true,
    sortKey: 'atendimentos',
    align: 'right',
    accessor: (row) => row.nAtendimentos,
  },
  {
    key: 'ticketsAtendidos',
    header: 'Tickets atendidos',
    sortable: true,
    sortKey: 'ticketsatendidos',
    align: 'right',
    accessor: (row) => formatNumeroOpcional(row.ticketsAtendidos),
  },
  {
    key: 'mediaTicketsUltimos3Meses',
    header: 'Média de tickets (3 meses)',
    headerInfo: 'Média mensal de tickets distintos atendidos nos 3 meses fechados anteriores.',
    sortable: true,
    sortKey: 'media3meses',
    align: 'right',
    accessor: (row) => formatNumeroOpcional(row.mediaTicketsUltimos3Meses, 2),
  },
  {
    key: 'mediaResolvidosPorDia',
    header: 'Resolvidos por dia',
    headerInfo: 'Tickets fechados no período em que o analista apontou, por dia útil.',
    sortable: true,
    sortKey: 'resolvidospordia',
    align: 'right',
    accessor: (row) => formatNumeroOpcional(row.mediaResolvidosPorDia, 2),
  },
  {
    key: 'totalSegundos',
    header: 'Tempo total',
    sortable: true,
    sortKey: 'totalsegundos',
    align: 'right',
    accessor: (row) => formatSeconds(row.totalSegundos),
  },
  {
    key: 'horasUteisSegundos',
    header: 'Horas úteis',
    headerInfo: 'Dias úteis do período até hoje multiplicados pela jornada diária.',
    sortable: true,
    sortKey: 'horasuteis',
    align: 'right',
    accessor: (row) => formatSegundosOpcional(row.horasUteisSegundos),
  },
  {
    key: 'mediaSegundosPorTicket',
    header: 'Tempo médio por ticket',
    sortable: true,
    sortKey: 'mediaporticket',
    align: 'right',
    accessor: (row) => formatSegundosOpcional(row.mediaSegundosPorTicket),
  },
  {
    key: 'ahtSegundos',
    header: 'Tempo médio por apontamento',
    sortable: true,
    sortKey: 'aht',
    align: 'right',
    accessor: (row) => formatSegundosOpcional(row.ahtSegundos),
  },
  {
    key: 'mediaOciosoSegundosPorDia',
    header: 'Ocioso médio por dia',
    headerInfo: 'Média, nos dias úteis, do que faltou apontar para completar a jornada.',
    sortable: true,
    sortKey: 'ocioso',
    align: 'right',
    accessor: (row) => formatSegundosOpcional(row.mediaOciosoSegundosPorDia),
  },
  {
    key: 'mediaPausas',
    header: 'Média de pausas',
    sortable: true,
    sortKey: 'mediapausas',
    align: 'right',
    accessor: (row) => formatNumeroOpcional(row.mediaPausas, 1),
  },
]
