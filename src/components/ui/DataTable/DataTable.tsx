import { clsx } from 'clsx'
import { SortableHeader } from './SortableHeader'
import type { ColumnDef, SortState } from './types'

type DataTableProps<TRow> = {
  /** ID único da tabela (mantido por compatibilidade; usado em testes/identificação) */
  tableId: string
  columns: ColumnDef<TRow>[]
  data: TRow[]
  sortState?: SortState
  onSort?: (sortKey: string) => void
  onRowClick?: (row: TRow) => void
  isClickable?: boolean
  className?: string
}

const alignClasses = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
}

/**
 * DataTable genérica do Design System BMS.
 * - Header: 12px, 500, center, h-36px, canto 5px 5px 0 0, border 0.7px
 * - Cell: 12px, 400
 * - Row: h-38px, padding 9px 20px, border 0.7px, hover sombra
 * - Ordenação server-side por coluna (clique no header alterna asc/desc)
 *
 * Nota: a reordenação de colunas por arrastar foi removida (071) — o drag no
 * cabeçalho interceptava o clique do botão de ordenar, impedindo o toggle.
 */
export function DataTable<TRow>({
  columns,
  data,
  sortState,
  onSort,
  onRowClick,
  isClickable,
  className,
}: DataTableProps<TRow>) {
  return (
    <div className={clsx('w-full overflow-x-auto', className)}>
      <table className="w-full border-collapse text-[12px]">
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                style={{ width: col.width }}
                className={clsx(
                  // Especificações frontend.md
                  'h-9 px-5 font-medium text-foreground/80 bg-background',
                  'border-[0.7px] border-border',
                  'first:rounded-tl-[5px] last:rounded-tr-[5px]',
                  'select-none',
                  'border-b border-border',
                  alignClasses[col.align ?? 'center'],
                )}
              >
                <SortableHeader
                  label={col.headerNode ?? col.header}
                  sortKey={col.sortKey}
                  sortable={col.sortable}
                  sortState={sortState}
                  onSort={onSort}
                  align={col.align ?? 'center'}
                />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, rowIdx) => (
            <tr
              key={rowIdx}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              role={isClickable || onRowClick ? 'button' : undefined}
              tabIndex={isClickable || onRowClick ? 0 : undefined}
              onKeyDown={
                isClickable || onRowClick
                  ? (e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        onRowClick?.(row)
                      }
                    }
                  : undefined
              }
              className={clsx(
                'border-[0.7px] border-border border-t-0',
                (isClickable || onRowClick) &&
                  'cursor-pointer hover:shadow-[0_1px_3px_1px_rgba(0,0,0,0.15)] focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset transition-shadow duration-150',
              )}
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={clsx(
                    'h-[38px] px-5 py-[9px] font-normal text-foreground',
                    alignClasses[col.align ?? 'left'],
                  )}
                >
                  {col.accessor(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
