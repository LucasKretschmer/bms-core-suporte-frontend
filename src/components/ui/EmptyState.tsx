import { EmptyState as DsEmptyState } from '@migrate/design-system'
import { Button } from './Button'

type EmptyStateProps = {
  message: string
  icon?: React.ReactNode
  action?: { label: string; onClick: () => void }
  className?: string
}

/**
 * Estado vazio — nunca deixar a tela em branco sem feedback.
 *
 * Wrapper sobre o DS `EmptyState`. O DS espera `action?: ReactNode` (o app usa
 * `{ label, onClick }`) — o wrapper monta o botão a partir do `Button` local.
 */
export function EmptyState({ message, icon, action, className }: EmptyStateProps) {
  return (
    <DsEmptyState
      message={message}
      icon={icon}
      action={
        action && (
          <Button variant="secondary" onClick={action.onClick}>
            {action.label}
          </Button>
        )
      }
      className={className}
    />
  )
}
