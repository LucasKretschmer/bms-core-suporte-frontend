import { clsx } from 'clsx'

type KpiCardGridProps = {
  children: React.ReactNode
  className?: string
}

/**
 * Grid responsivo de KpiCards.
 * 2 colunas em mobile → 3 em md → 4 em lg → 5 em xl.
 */
export function KpiCardGrid({ children, className }: KpiCardGridProps) {
  return (
    <div
      className={clsx(
        'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3',
        className,
      )}
    >
      {children}
    </div>
  )
}
