import { clsx } from 'clsx'
import { InfoIcon } from '../InfoIcon'
import type { SortState } from './types'

type SortableHeaderProps = {
  label: React.ReactNode
  sortKey?: string
  sortable?: boolean
  sortState?: SortState
  onSort?: (sortKey: string) => void
  align?: 'left' | 'center' | 'right'
  /**
   * Texto de tooltip (ⓘ) exibido ao lado do rótulo. O ícone é renderizado
   * **como irmão** do botão de ordenação — nunca dentro dele — para evitar
   * aninhamento de `<button>` (HTML inválido) e para que clicar no (i) apenas
   * mostre o tooltip, sem disparar a ordenação (098 round 2).
   */
  headerInfo?: string
}

const alignClasses = {
  left: 'justify-start',
  center: 'justify-center',
  right: 'justify-end',
}

/**
 * Conteúdo do cabeçalho de coluna.
 *
 * Quando a coluna é ordenável, o rótulo textual + a seta de ordenação vivem em
 * um `<button>` que **preenche a célula `<th>`** (largura e altura 100% +
 * padding do header), de modo que qualquer clique sobre o texto aciona a
 * ordenação (080). O `<button>` preserva a acessibilidade (foco/Enter/Espaço)
 * e o toggle asc/desc (071).
 *
 * O ícone informativo (ⓘ), quando presente, é renderizado **fora** do botão de
 * ordenação (irmão dentro do `<th>`). Isso evita `<button>` dentro de
 * `<button>` (HTML inválido) e garante que clicar no (i) mostre apenas o
 * tooltip — nunca ordene (098 round 2).
 *
 * Quando a coluna não é ordenável, renderiza apenas o rótulo estático (sem
 * clique, sem cursor pointer, sem hover de ordenação), com o (i) ao lado.
 */
export function SortableHeader({
  label,
  sortKey,
  sortable,
  sortState,
  onSort,
  align = 'center',
  headerInfo,
}: SortableHeaderProps) {
  const canSort = Boolean(sortable && sortKey && onSort)
  const isActive = Boolean(sortable && sortKey && sortState?.sortBy === sortKey)
  const direction = isActive ? sortState?.sortDirection : null

  function handleSort() {
    if (sortable && sortKey && onSort) {
      onSort(sortKey)
    }
  }

  // Ícone (i) — sempre irmão do conteúdo do rótulo, nunca dentro do botão.
  const infoNode = headerInfo ? <InfoIcon tooltip={headerInfo} /> : null

  if (!canSort) {
    // Coluna não-ordenável: rótulo estático, sem interação de ordenação.
    return (
      <div
        className={clsx(
          'flex h-9 w-full items-center gap-1 px-5 whitespace-nowrap',
          alignClasses[align],
        )}
      >
        <span>{label}</span>
        {infoNode}
      </div>
    )
  }

  return (
    // Wrapper flex dentro do <th>: o botão de ordenação e o (i) são irmãos.
    // whitespace-nowrap mantém rótulo + seta + (i) em uma única linha,
    // preservando a altura do header do DS (~36px) — corrige a quebra em 2
    // linhas de rótulos longos (098).
    <div
      className={clsx(
        'flex h-9 w-full items-center gap-1 whitespace-nowrap',
        alignClasses[align],
      )}
    >
      <button
        type="button"
        onClick={handleSort}
        aria-label={`Ordenar por ${typeof label === 'string' ? label : sortKey}`}
        className={clsx(
          // Sem (i): o botão preenche a célula inteira (w-full) para que
          // qualquer clique no cabeçalho ordene (080). Com (i): ocupa a área
          // restante (flex-1), deixando o ícone de fora e clicável à parte.
          'flex h-9 min-w-0 cursor-pointer items-center gap-1 whitespace-nowrap',
          infoNode ? 'flex-1 pl-5 pr-1' : 'w-full px-5',
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
      {infoNode && <span className="pr-5">{infoNode}</span>}
    </div>
  )
}
