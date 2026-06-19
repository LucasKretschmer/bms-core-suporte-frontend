import { clsx } from 'clsx'
import type { SortState } from './types'

type SortableHeaderProps = {
  label: React.ReactNode
  sortKey?: string
  sortable?: boolean
  sortState?: SortState
  onSort?: (sortKey: string) => void
  align?: 'left' | 'center' | 'right'
}

const alignClasses = {
  left: 'justify-start',
  center: 'justify-center',
  right: 'justify-end',
}

/**
 * Header de coluna com botão de ordenação (asc/desc).
 * Ícone indica a direção atual ou neutro se não está ordenado.
 */
export function SortableHeader({
  label,
  sortKey,
  sortable,
  sortState,
  onSort,
  align = 'center',
}: SortableHeaderProps) {
  const isActive = sortable && sortKey && sortState?.sortBy === sortKey
  const direction = isActive ? sortState?.sortDirection : null

  function handleSort() {
    if (sortable && sortKey && onSort) {
      onSort(sortKey)
    }
  }

  return (
    <div
      className={clsx('flex items-center gap-1', alignClasses[align])}
    >
      <span>{label}</span>
      {sortable && sortKey && (
        <button
          type="button"
          onClick={handleSort}
          aria-label={`Ordenar por ${typeof label === 'string' ? label : sortKey}`}
          className={clsx(
            'inline-flex flex-col items-center justify-center gap-px',
            'text-muted hover:text-foreground transition-colors',
            isActive && 'text-primary',
          )}
        >
          {direction === 'asc' ? (
            <svg aria-hidden="true" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
            </svg>
          ) : direction === 'desc' ? (
            <svg aria-hidden="true" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          ) : (
            // Ícone neutro (ambas setas)
            <svg aria-hidden="true" className="h-3 w-3 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
            </svg>
          )}
        </button>
      )}
    </div>
  )
}
