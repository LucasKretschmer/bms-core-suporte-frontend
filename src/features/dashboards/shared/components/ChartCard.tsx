import { useId } from 'react'
import { clsx } from 'clsx'
import { Skeleton } from '../../../../components/ui/Skeleton'
import { ErrorState } from '../../../../components/ui/ErrorState'
import { EmptyState } from '../../../../components/ui/EmptyState'

type ChartCardProps = {
  /** ID manual — se omitido, gerado via useId() (AP-FRONTEND-003) */
  id?: string
  title: string
  isLoading?: boolean
  isError?: boolean
  isEmpty?: boolean
  emptyMessage?: string
  onRetry?: () => void
  /** Ícone de drill-down no canto superior direito — undefined = não clicável */
  onDrillDown?: () => void
  /** Ação extra no header (ex.: ExportButtons) — renderizada à esquerda do ícone de drill. */
  headerAction?: React.ReactNode
  height?: number
  children: React.ReactNode
  className?: string
}

/**
 * Wrapper de gráfico Recharts.
 * Gerencia estados loading/error/empty e exibe ícone de drill-down.
 */
export function ChartCard({
  id: idProp,
  title,
  isLoading = false,
  isError = false,
  isEmpty = false,
  emptyMessage,
  onRetry,
  onDrillDown,
  headerAction,
  height = 240,
  children,
  className,
}: ChartCardProps) {
  const generatedId = useId()
  const rootId = idProp ?? generatedId
  const titleId = `${rootId}-title`

  function renderContent() {
    if (isLoading) {
      return <Skeleton lines={1} height={`h-[${height}px]`} className="w-full" />
    }
    if (isError) {
      return <ErrorState onRetry={onRetry} className="py-8" />
    }
    if (isEmpty) {
      return (
        <EmptyState
          message={emptyMessage ?? 'Sem dados para o período.'}
          className="py-8"
        />
      )
    }
    return children
  }

  return (
    <section
      id={rootId}
      aria-labelledby={titleId}
      className={clsx(
        'flex flex-col gap-3 rounded-card border border-border bg-card p-4 pt-3',
        className,
      )}
    >
      {/* Header do card */}
      <div className="flex items-center justify-between">
        <h3 id={titleId} className="text-[16px] font-medium text-foreground">
          {title}
        </h3>
        <div className="flex items-center gap-2">
          {headerAction}
        {onDrillDown && (
          <button
            type="button"
            onClick={onDrillDown}
            aria-label="Ver detalhes"
            title="Ver detalhes"
            className={clsx(
              'text-muted hover:text-foreground transition-colors duration-150',
              'focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none rounded',
              'hover:shadow-hover',
            )}
          >
            <svg
              aria-hidden="true"
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
              />
            </svg>
          </button>
        )}
        </div>
      </div>

      {/* Conteúdo */}
      <div>{renderContent()}</div>
    </section>
  )
}
