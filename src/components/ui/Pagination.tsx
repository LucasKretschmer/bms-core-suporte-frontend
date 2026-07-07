import { clsx } from 'clsx'
import type { ComboboxOption } from './Combobox'
import { Combobox } from './Combobox'

type PaginationProps = {
  page: number
  pageSize: number
  totalCount: number
  totalPages: number
  pageSizeOptions?: number[]
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
}

/**
 * Paginação retematizada para o Migrate Design System (110/P3).
 * Mantém o seletor de pageSize customizado local (`Combobox`, abre para
 * cima) — decisão do Manager, não substituído pelo `<select>` nativo do DS.
 */
export function Pagination({
  page,
  pageSize,
  totalCount,
  totalPages,
  pageSizeOptions = [25, 50, 100, 200],
  onPageChange,
  onPageSizeChange,
}: PaginationProps) {
  const sizeOptions: ComboboxOption[] = pageSizeOptions.map((s) => ({
    value: String(s),
    label: `${s} por página`,
  }))

  // Calcular páginas visíveis (máximo 5 ao redor da atual)
  const pages: (number | '...')[] = []
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i)
  } else {
    pages.push(1)
    if (page > 3) pages.push('...')
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) {
      pages.push(i)
    }
    if (page < totalPages - 2) pages.push('...')
    pages.push(totalPages)
  }

  return (
    <div className="flex items-center justify-between py-2 gap-3 flex-wrap">
      {/* Total de registros */}
      <span className="text-xs text-muted">
        {totalCount === 0 ? 'Nenhum registro' : `${totalCount} registro${totalCount !== 1 ? 's' : ''}`}
      </span>

      {/* Navegação de páginas */}
      <div className="flex items-center gap-1">
        <PageButton
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Página anterior"
        >
          ‹
        </PageButton>

        {pages.map((p, i) =>
          p === '...' ? (
            <span key={`ellipsis-${i}`} className="flex size-6 items-center justify-center text-xs text-muted">
              …
            </span>
          ) : (
            <PageButton
              key={p}
              onClick={() => onPageChange(p as number)}
              active={p === page}
              aria-label={`Página ${p}`}
              aria-current={p === page ? 'page' : undefined}
            >
              {p}
            </PageButton>
          ),
        )}

        <PageButton
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          aria-label="Próxima página"
        >
          ›
        </PageButton>
      </div>

      {/* Seletor de itens por página — abre para cima */}
      <div className="w-36">
        <Combobox
          value={String(pageSize)}
          options={sizeOptions}
          onChange={(v) => onPageSizeChange(Number(v))}
          openUp
          size="sm"
          placeholder="Por página"
        />
      </div>
    </div>
  )
}

type PageButtonProps = {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
  active?: boolean
  'aria-label'?: string
  'aria-current'?: 'page'
}

function PageButton({ children, onClick, disabled, active, ...aria }: PageButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      {...aria}
      className={clsx(
        'flex size-6 items-center justify-center rounded text-xs font-bold',
        'transition-shadow duration-150',
        active ? 'bg-primary text-white' : 'text-primary hover:shadow-hover',
        'disabled:cursor-not-allowed disabled:opacity-40 disabled:pointer-events-none disabled:hover:shadow-none',
      )}
    >
      {children}
    </button>
  )
}
