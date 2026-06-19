import { Link } from '@tanstack/react-router'
import { clsx } from 'clsx'

export type BreadcrumbItem = {
  label: string
  href?: string
}

type BreadcrumbProps = {
  items: BreadcrumbItem[]
  className?: string
}

/**
 * Breadcrumb de navegação. Último item sem link.
 * Separador: •
 */
export function Breadcrumb({ items, className }: BreadcrumbProps) {
  return (
    <nav aria-label="Navegação estrutural" className={clsx('flex items-center flex-wrap gap-1 text-xs text-foreground/60', className)}>
      {items.map((item, idx) => {
        const isLast = idx === items.length - 1
        return (
          <span key={idx} className="flex items-center gap-1">
            {idx > 0 && <span aria-hidden="true" className="text-foreground/40">•</span>}
            {isLast || !item.href ? (
              <span
                className={isLast ? 'text-foreground/80 font-medium' : ''}
                aria-current={isLast ? 'page' : undefined}
              >
                {item.label}
              </span>
            ) : (
              <Link
                to={item.href}
                className="hover:text-primary transition-colors"
              >
                {item.label}
              </Link>
            )}
          </span>
        )
      })}
    </nav>
  )
}
