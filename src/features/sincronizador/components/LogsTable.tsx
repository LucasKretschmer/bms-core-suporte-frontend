import { clsx } from 'clsx'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { DataTable } from '../../../components/ui/DataTable/DataTable'
import type { ColumnDef, SortState } from '../../../components/ui/DataTable/types'
import { DurationLabel } from './DurationLabel'
import type { LogDto, SyncLogTipo, SyncStatus } from '../types/sincronizador'

type LogsTableProps = {
  data: LogDto[]
  sortBy: string
  sortDirection: 'asc' | 'desc'
  onSort: (key: string) => void
}

type StatusBadgeConfig = {
  bg: string
  fg: string
  label: string
}

const STATUS_CONFIG: Record<SyncStatus, StatusBadgeConfig> = {
  executando: { bg: 'bg-warning-bg', fg: 'text-warning-fg', label: 'Executando' },
  concluido:  { bg: 'bg-success-bg', fg: 'text-success-fg', label: 'Concluído' },
  erro:       { bg: 'bg-error-bg',   fg: 'text-error-fg',   label: 'Erro' },
}

/** Badge de status para cada linha da tabela de logs */
function SyncStatusRowBadge({ status }: { status: SyncStatus }) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.erro
  return (
    <span
      className={clsx(
        'inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium',
        config.bg,
        config.fg,
      )}
    >
      {config.label}
    </span>
  )
}

function formatDisparo(disparo: string): string {
  return disparo === 'automatico' ? 'Automático' : 'Manual'
}

const TIPO_LABEL: Record<SyncLogTipo, string> = {
  tickets: 'Tickets',
  empresas: 'Empresas',
}

/**
 * Rótulo do tipo da rodada (088).
 * Logs antigos podem não trazer `tipo` no wire (linhas anteriores à migration);
 * nesse caso assume 'tickets' — comportamento histórico.
 */
function formatTipo(tipo: SyncLogTipo | undefined): string {
  return TIPO_LABEL[tipo ?? 'tickets']
}

/** Placeholder de célula sem valor aplicável ao tipo da rodada. */
function EmptyCell() {
  return <span className="text-foreground/30">—</span>
}

function formatDate(iso: string): string {
  try {
    return format(parseISO(iso), 'dd/MM/yyyy HH:mm:ss', { locale: ptBR })
  } catch {
    return iso
  }
}

const COLUMNS: ColumnDef<LogDto>[] = [
  {
    key: 'status',
    header: 'Status',
    sortable: true,
    sortKey: 'status',
    align: 'center',
    width: '110px',
    accessor: (row) => <SyncStatusRowBadge status={row.status} />,
  },
  {
    key: 'disparo',
    header: 'Disparo',
    sortable: false,
    align: 'center',
    width: '100px',
    accessor: (row) => formatDisparo(row.disparo),
  },
  {
    key: 'tipo',
    header: 'Tipo',
    sortable: false,
    align: 'center',
    width: '90px',
    accessor: (row) => formatTipo(row.tipo),
  },
  {
    key: 'iniciadoEm',
    header: 'Iniciado em',
    sortable: true,
    sortKey: 'iniciadoEm',
    align: 'center',
    width: '160px',
    accessor: (row) => formatDate(row.iniciadoEm),
  },
  {
    key: 'duracaoMs',
    header: 'Duração',
    sortable: true,
    sortKey: 'duracaoMs',
    align: 'center',
    width: '90px',
    accessor: (row) => <DurationLabel duracaoMs={row.duracaoMs} />,
  },
  {
    key: 'contadores',
    header: 'Tickets / Projetos',
    sortable: false,
    align: 'center',
    // Só aplica a rodadas de tickets; rodadas de empresas não têm esses contadores.
    accessor: (row) =>
      (row.tipo ?? 'tickets') === 'empresas' ? (
        <EmptyCell />
      ) : (
        <span className="text-foreground/80">
          {row.ticketsUpserted}↑ {row.ticketsIgnorados}↷ / {row.projetosUpserted}↑{' '}
          {row.projetosIgnorados}↷
        </span>
      ),
  },
  {
    key: 'empresas',
    header: 'Empresas',
    sortable: false,
    align: 'center',
    width: '160px',
    // Rodada de empresas → criadas/atualizadas/desativadas (088).
    // Rodada de tickets → empresas/contatos resolvidos (comportamento anterior).
    accessor: (row) =>
      (row.tipo ?? 'tickets') === 'empresas' ? (
        <span
          className="text-foreground/80"
          title="Criadas / Atualizadas / Desativadas"
        >
          {row.empresasCriadas}+ {row.empresasAtualizadas}~ {row.empresasDesativadas}−
        </span>
      ) : (
        `${row.empresasResolvidas} / ${row.contatosResolvidos}`
      ),
  },
  {
    key: 'mensagemErro',
    header: 'Erro',
    sortable: false,
    align: 'left',
    accessor: (row) =>
      row.mensagemErro ? (
        <span
          title={row.mensagemErro}
          className="block truncate max-w-[200px] text-error-fg text-xs"
        >
          {row.mensagemErro}
        </span>
      ) : (
        <span className="text-foreground/30">—</span>
      ),
  },
]

/**
 * Tabela de logs do sincronizador.
 * Usa DataTable genérico do design system.
 * tableId="sincronizador-logs" para persistir ordem de colunas.
 */
export function LogsTable({ data, sortBy, sortDirection, onSort }: LogsTableProps) {
  const sortState: SortState = { sortBy, sortDirection }

  return (
    <DataTable
      tableId="sincronizador-logs"
      columns={COLUMNS}
      data={data}
      sortState={sortState}
      onSort={onSort}
    />
  )
}
