import { useId } from 'react'
import { clsx } from 'clsx'
import { Skeleton } from '../../../../components/ui/Skeleton'
import { InfoIcon } from '../../../../components/ui/InfoIcon'

type SubtextVariant = 'positive' | 'negative' | 'neutral'

type KpiCardProps = {
  /** ID manual — se omitido, gerado via useId() (AP-FRONTEND-003) */
  id?: string
  label: string
  value: string | number | null | undefined
  subtext?: string | null
  subtextVariant?: SubtextVariant
  formatter?: (v: number) => string
  isLoading?: boolean
  onClick?: () => void
  className?: string
  tooltipText?: string
}

const subtextVariantClasses: Record<SubtextVariant, string> = {
  positive: 'text-success-fg',
  negative: 'text-error-fg',
  neutral: 'text-muted',
}

/**
 * Card de KPI.
 * - value === null | undefined → "—" (toleratesNull)
 * - isLoading → Skeleton
 * - onClick → role="button", tabIndex=0, hover por sombra
 */
export function KpiCard({
  id: idProp,
  label,
  value,
  subtext,
  subtextVariant = 'neutral',
  formatter,
  isLoading = false,
  onClick,
  className,
  tooltipText,
}: KpiCardProps) {
  const generatedId = useId()
  const rootId = idProp ?? generatedId
  const subtextId = `${rootId}-subtext`
  const isClickable = !!onClick

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Enter' && onClick) {
      onClick()
    }
  }

  function renderValue() {
    if (isLoading) {
      return <Skeleton lines={1} height="h-8" className="w-24" />
    }
    if (value === null || value === undefined) {
      return <span className="text-2xl font-bold text-foreground">—</span>
    }
    if (typeof value === 'number' && formatter) {
      return <span className="text-2xl font-bold text-foreground">{formatter(value)}</span>
    }
    return <span className="text-2xl font-bold text-foreground">{value}</span>
  }

  return (
    <div
      id={rootId}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onClick={isClickable ? onClick : undefined}
      onKeyDown={isClickable ? handleKeyDown : undefined}
      aria-describedby={subtext ? subtextId : undefined}
      className={clsx(
        'flex flex-col gap-1 min-h-[80px] rounded-card border border-border bg-card p-4',
        isClickable && 'cursor-pointer hover:shadow-hover transition-shadow duration-150',
        isClickable && 'focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none',
        className,
      )}
    >
      {/* Label + ícone de info */}
      <div className="flex items-center gap-1">
        <span className="text-xs text-muted leading-none">{label}</span>
        {tooltipText && (
          <InfoIcon
            tooltip={tooltipText}
            className="h-3 w-3 text-muted shrink-0"
          />
        )}
      </div>

      {/* Valor */}
      <div className="mt-1">{renderValue()}</div>

      {/* Subtext (comparativo) */}
      {subtext && (
        <p
          id={subtextId}
          className={clsx('text-xs', subtextVariantClasses[subtextVariant])}
        >
          {subtext}
        </p>
      )}
    </div>
  )
}
