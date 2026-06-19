import { Badge } from '../../components/ui/Badge'
import type { ColumnDef } from '../../components/ui/DataTable/types'
import type { AgentDto } from './types/team'

/**
 * Colunas da tabela Atendente / Equipe / Papel.
 * Ordenáveis client-side (B5 retorna lista completa sem paginação).
 * O papel já vem pronto do backend — Badge com fallback neutro.
 */
export const agentColumns: ColumnDef<AgentDto>[] = [
  {
    key: 'nome',
    header: 'Atendente',
    align: 'left',
    sortable: true,
    sortKey: 'nome',
    accessor: (row) => row.nome,
  },
  {
    key: 'equipe',
    header: 'Equipe',
    align: 'left',
    sortable: true,
    sortKey: 'equipe',
    accessor: (row) => row.equipeNome ?? '—',
  },
  {
    key: 'papel',
    header: 'Papel',
    align: 'center',
    sortable: true,
    sortKey: 'papel',
    accessor: (row) => <Badge value={row.papel} />,
  },
]

/** Valor de ordenação por chave de coluna (client-side). */
export function agentSortValue(agent: AgentDto, sortBy: string): string {
  switch (sortBy) {
    case 'equipe':
      return agent.equipeNome ?? ''
    case 'papel':
      return agent.papel
    case 'nome':
    default:
      return agent.nome
  }
}
