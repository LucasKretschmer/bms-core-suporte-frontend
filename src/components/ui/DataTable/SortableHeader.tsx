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
 * Conteúdo do cabeçalho de coluna.
 *
 * Quando a coluna é ordenável, o cabeçalho é um `<button>` que **preenche a
 * célula `<th>` inteira** (largura e altura 100% + padding do header), de modo
 * que qualquer clique no cabeçalho aciona a ordenação (080). O `<button>` real
 * preserva a acessibilidade (foco/Enter/Espaço) e o toggle asc/desc (071).
 *
 * Quando a coluna não é ordenável, renderiza apenas o rótulo estático (sem
 * clique, sem cursor pointer, sem hover de ordenação).
 */
export function SortableHeader({
  label,
  sortKey,
  sortable,
  sortState,
  onSort,
  align = 'center',
}: SortableHeaderProps) {
  const canSort = Boolean(sortable && sortKey && onSort)
  const isActive = Boolean(sortable && sortKey && sortState?.sortBy === sortKey)
  const direction = isActive ? sortState?.sortDirection : null

  function handleSort() {
    if (sortable && sortKey && onSort) {
      onSort(sortKey)
    }
  }

  if (!canSort) {
    // Coluna não-ordenável: rótulo estático, sem interação.
    return (
      <div
        className={clsx(
          'flex h-9 w-full items-center gap-1 px-5',
          alignClasses[align],
        )}
      >
        <span>{label}</span>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={handleSort}
      aria-label={`Ordenar por ${typeof label === 'string' ? label : sortKey}`}
      className={clsx(
        // Preenche o <th> inteiro para que qualquer clique ordene (080).
        'flex h-9 w-full cursor-pointer items-center gap-1 px-5',
        'text-inherit transition-colors',
        'hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset',
        alignClasses[align],
        isActive && 'text-primary',
      )}
    >
      <span>{label}</span>
      <span
        aria-hidden="true"
        className={clsx(
          'inline-flex flex-col items-center justify-center gap-px',
          isActive ? 'text-primary' : 'text-muted',
        )}
      >
        {direction === 'asc' ? (
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
          </svg>
        ) : direction === 'desc' ? (
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        ) : (
          // Ícone neutro (ambas setas)
          <svg className="h-3 w-3 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
          </svg>
        )}
      </span>
    </button>
  )
}
