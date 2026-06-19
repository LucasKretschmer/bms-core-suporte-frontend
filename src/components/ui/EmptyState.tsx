import { clsx } from 'clsx'
import { Button } from './Button'

type EmptyStateProps = {
  message: string
  icon?: React.ReactNode
  action?: { label: string; onClick: () => void }
  className?: string
}

/** Estado vazio — nunca deixar a tela em branco sem feedback. */
export function EmptyState({ message, icon, action, className }: EmptyStateProps) {
  return (
    <div
      className={clsx(
        'flex flex-col items-center justify-center py-16 gap-4 text-center',
        className,
      )}
    >
      {icon && <div className="text-foreground/30">{icon}</div>}
      {!icon && (
        <svg
          aria-hidden="true"
          className="h-12 w-12 text-foreground/20"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      )}
      <p className="text-xs text-foreground/30 italic">{message}</p>
      {action && (
        <Button variant="secondary" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  )
}
