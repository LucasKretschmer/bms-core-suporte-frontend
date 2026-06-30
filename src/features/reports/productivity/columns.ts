import type { ColumnDef } from '../../../components/ui/DataTable/types'
import type { AgentMetricDto } from '../shared/types/reports'
import { formatSeconds, formatDecimal } from '../shared/utils/formatters'

/**
 * Colunas da tabela U6 — Produtividade por Analista.
 *
 * Ordenação (053): o endpoint GET /api/v1/reports/productivity NÃO aceita sortBy —
 * o backend ordena de forma fixa por TotalSegundos desc (GetProductivityReportAsync).
 * Para não forjar ordenação client-side sobre dados paginados no servidor, TODAS as
 * colunas ficam `sortable: false`. Reabilitar coluna a coluna quando o backend
 * adicionar a whitelist de sortBy (gap reportado no handoff 053).
 */
export const productivityColumns: ColumnDef<AgentMetricDto>[] = [
  {
    key: 'nome',
    header: 'Analista',
    sortable: false,
    align: 'left',
    accessor: (row) => row.nome,
  },
  {
    key: 'equipe',
    header: 'Equipe',
    sortable: false,
    align: 'left',
    accessor: (row) => row.equipe ?? '—',
  },
  {
    key: 'nAtendimentos',
    header: 'Atendimentos',
    sortable: false,
    align: 'right',
    accessor: (row) => row.nAtendimentos,
  },
  {
    key: 'totalSegundos',
    header: 'Tempo Total',
    sortable: false,
    align: 'right',
    accessor: (row) => formatSeconds(row.totalSegundos),
  },
  {
    key: 'ahtSegundos',
    header: 'AHT (Tempo Médio)',
    sortable: false,
    align: 'right',
    accessor: (row) =>
      row.ahtSegundos !== null ? formatSeconds(row.ahtSegundos) : '—',
  },
  {
    key: 'mediaPausas',
    header: 'Média de Pausas',
    sortable: false,
    align: 'right',
    accessor: (row) => formatDecimal(row.mediaPausas),
  },
]
