import type { ColumnDef } from '../../../components/ui/DataTable/types'
import type { AgentMetricDto } from '../shared/types/reports'
import { formatSeconds, formatDecimal } from '../shared/utils/formatters'

/**
 * Colunas da tabela U6 — Produtividade por Analista.
 * Todas as colunas sortáveis. sortKey deve casar com whitelist do backend.
 */
export const productivityColumns: ColumnDef<AgentMetricDto>[] = [
  {
    key: 'nome',
    header: 'Analista',
    sortable: true,
    sortKey: 'nome',
    align: 'left',
    accessor: (row) => row.nome,
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
    key: 'nAtendimentos',
    header: 'Atendimentos',
    sortable: true,
    sortKey: 'natendimentos',
    align: 'right',
    accessor: (row) => row.nAtendimentos,
  },
  {
    key: 'totalSegundos',
    header: 'Tempo Total',
    sortable: true,
    sortKey: 'totalsegundos',
    align: 'right',
    accessor: (row) => formatSeconds(row.totalSegundos),
  },
  {
    key: 'ahtSegundos',
    header: 'AHT (Tempo Médio)',
    sortable: true,
    sortKey: 'ahtsegundos',
    align: 'right',
    accessor: (row) =>
      row.ahtSegundos !== null ? formatSeconds(row.ahtSegundos) : '—',
  },
  {
    key: 'mediaPausas',
    header: 'Média de Pausas',
    sortable: true,
    sortKey: 'mediapausas',
    align: 'right',
    accessor: (row) => formatDecimal(row.mediaPausas),
  },
]
