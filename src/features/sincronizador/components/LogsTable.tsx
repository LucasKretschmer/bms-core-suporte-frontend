import { clsx } from 'clsx'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { DataTable } from '../../../components/ui/DataTable/DataTable'
import type { ColumnDef, SortState } from '../../../components/ui/DataTable/types'
import { DurationLabel } from './DurationLabel'
import type { SincronizacaoLogDto, SyncStatus } from '../types/sincronizador'

type LogsTableProps = {
  data: SincronizacaoLogDto[]
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

function formatDate(iso: string): string {
  try {
    return format(parseISO(iso), 'dd/MM/yyyy HH:mm:ss', { locale: ptBR })
  } catch {
    return iso
  }
}

const COLUMNS: ColumnDef<SincronizacaoLogDto>[] = [
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
    key: 'iniciadoem',
    header: 'Iniciado em',
    sortable: true,
    sortKey: 'iniciadoem',
    align: 'center',
    width: '160px',
    accessor: (row) => formatDate(row.iniciadoem),
  },
  {
    key: 'duracaoms',
    header: 'Duração',
    sortable: true,
    sortKey: 'duracaoms',
    align: 'center',
    width: '90px',
    accessor: (row) => <DurationLabel duracaoms={row.duracaoms} />,
  },
  {
    key: 'contadores',
    header: 'Tickets / Projetos',
    sortable: false,
    align: 'center',
    accessor: (row) => (
      <span className="text-foreground/80">
        {row.ticketsupserted}↑ {row.ticketsignorados}↷ / {row.projetosupserted}↑{' '}
        {row.projetosignorados}↷
      </span>
    ),
  },
  {
    key: 'empresas',
    header: 'Emp. / Cont.',
    sortable: false,
    align: 'center',
    width: '100px',
    accessor: (row) => `${row.empresasresolvidas} / ${row.contatosresolvidos}`,
  },
  {
    key: 'mensagemerro',
    header: 'Erro',
    sortable: false,
    align: 'left',
    accessor: (row) =>
      row.mensagemerro ? (
        <span
          title={row.mensagemerro}
          className="block truncate max-w-[200px] text-error-fg text-xs"
        >
          {row.mensagemerro}
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
