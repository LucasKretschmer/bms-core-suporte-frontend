import { Badge } from '../../components/ui/Badge'
import type { ColumnDef } from '../../components/ui/DataTable/types'
import { AgentRoleCell } from './components/AgentRoleCell'
import type { AgentDto } from './types/team'

type AgentColumnsOptions = {
  /** Se o usuário logado pode editar papéis (UX — backend é a fonte de verdade). */
  canEditRole: boolean
  /** Id do usuário logado, para sinalizar a própria linha (aviso de re-login). */
  currentUserId: number | null
}

/**
 * Colunas da tabela Atendente / E-mail / Equipe / Perfil.
 * Ordenáveis client-side (B5 retorna lista completa sem paginação).
 *
 * #12 — coluna "E-mail" (campo `email` já vem do backend; null → "—").
 * #13 — coluna "Perfil" com combobox (atendente/gestor) que dispara mutation.
 *        Quando o usuário não pode editar, exibe um Badge somente-leitura.
 */
export function buildAgentColumns({
  canEditRole,
  currentUserId,
}: AgentColumnsOptions): ColumnDef<AgentDto>[] {
  return [
    {
      key: 'nome',
      header: 'Atendente',
      align: 'left',
      sortable: true,
      sortKey: 'nome',
      accessor: (row) => row.nome,
    },
    {
      key: 'email',
      header: 'E-mail',
      align: 'left',
      sortable: true,
      sortKey: 'email',
      accessor: (row) => row.email ?? '—',
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
      header: 'Perfil',
      align: 'center',
      sortable: true,
      sortKey: 'papel',
      accessor: (row) =>
        canEditRole ? (
          <AgentRoleCell
            agent={row}
            canEdit={canEditRole}
            isSelf={currentUserId !== null && currentUserId === row.userId}
          />
        ) : (
          <Badge value={row.papel} />
        ),
    },
  ]
}

/** Valor de ordenação por chave de coluna (client-side). */
export function agentSortValue(agent: AgentDto, sortBy: string): string {
  switch (sortBy) {
    case 'email':
      return agent.email ?? ''
    case 'equipe':
      return agent.equipeNome ?? ''
    case 'papel':
      return agent.papel
    case 'nome':
    default:
      return agent.nome
  }
}
