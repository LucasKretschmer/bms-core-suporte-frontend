import { clsx } from 'clsx'
import { useEffect, useRef, useState } from 'react'
import { SortableHeader } from './SortableHeader'
import type { ColumnDef, SortState } from './types'

type DataTableProps<TRow> = {
  /** ID único da tabela — usado para persistir a ordem das colunas */
  tableId: string
  columns: ColumnDef<TRow>[]
  data: TRow[]
  sortState?: SortState
  onSort?: (sortKey: string) => void
  onRowClick?: (row: TRow) => void
  isClickable?: boolean
  className?: string
}

const STORAGE_KEY_PREFIX = 'table-col-order-'

function loadColumnOrder(tableId: string): string[] | null {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${tableId}`)
    if (!raw) return null
    return JSON.parse(raw) as string[]
  } catch {
    return null
  }
}

function saveColumnOrder(tableId: string, order: string[]): void {
  try {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${tableId}`, JSON.stringify(order))
  } catch {
    // Falha silenciosa — preferência de layout não é crítica
  }
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
 * - Ordenação server-side por coluna
 * - Reordenação de colunas via drag-and-drop, persiste em localStorage
 */
export function DataTable<TRow>({
  tableId,
  columns,
  data,
  sortState,
  onSort,
  onRowClick,
  isClickable,
  className,
}: DataTableProps<TRow>) {
  // Estado de ordem das colunas
  const [columnOrder, setColumnOrder] = useState<string[]>(() => {
    const saved = loadColumnOrder(tableId)
    if (saved) {
      // Validar que todas as colunas existem (pode ter mudado)
      const allKeys = columns.map((c) => c.key)
      const validSaved = saved.filter((k) => allKeys.includes(k))
      const missing = allKeys.filter((k) => !validSaved.includes(k))
      return [...validSaved, ...missing]
    }
    return columns.map((c) => c.key)
  })

  // Sincronizar quando colunas mudam (ex: feature nova)
  useEffect(() => {
    const allKeys = columns.map((c) => c.key)
    setColumnOrder((prev) => {
      const valid = prev.filter((k) => allKeys.includes(k))
      const missing = allKeys.filter((k) => !valid.includes(k))
      return [...valid, ...missing]
    })
  }, [columns])

  // Colunas ordenadas conforme preferência do usuário
  const orderedColumns = columnOrder
    .map((key) => columns.find((c) => c.key === key))
    .filter((c): c is ColumnDef<TRow> => c !== undefined)

  // Drag and drop
  const dragIndexRef = useRef<number | null>(null)

  function handleDragStart(idx: number) {
    dragIndexRef.current = idx
  }

  function handleDrop(idx: number) {
    if (dragIndexRef.current === null || dragIndexRef.current === idx) return
    const newOrder = [...columnOrder]
    const [removed] = newOrder.splice(dragIndexRef.current, 1)
    newOrder.splice(idx, 0, removed)
    setColumnOrder(newOrder)
    saveColumnOrder(tableId, newOrder)
    dragIndexRef.current = null
  }

  return (
    <div className={clsx('w-full overflow-x-auto', className)}>
      <table className="w-full border-collapse text-[12px]">
        <thead>
          <tr>
            {orderedColumns.map((col, idx) => (
              <th
                key={col.key}
                draggable
                onDragStart={() => handleDragStart(idx)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDrop(idx)}
                style={{ width: col.width }}
                className={clsx(
                  // Especificações frontend.md
                  'h-9 px-5 font-medium text-foreground/80 bg-background',
                  'border-[0.7px] border-border',
                  'first:rounded-tl-[5px] last:rounded-tr-[5px]',
                  'select-none cursor-grab active:cursor-grabbing',
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
              {orderedColumns.map((col) => (
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
