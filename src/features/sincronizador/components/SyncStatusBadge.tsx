import { clsx } from 'clsx'
import type { SyncStatus } from '../types/sincronizador'

type SyncStatusBadgeProps = {
  isOnline: boolean
  lastStatus: SyncStatus | null
  className?: string
}

type BadgeConfig = {
  dotClass: string
  label: string
  animate: boolean
}

function getConfig(isOnline: boolean, lastStatus: SyncStatus | null): BadgeConfig {
  if (!isOnline) {
    return { dotClass: 'bg-muted', label: 'Offline', animate: false }
  }
  if (lastStatus === 'erro') {
    return { dotClass: 'bg-warning-fg', label: 'Degradado', animate: false }
  }
  return { dotClass: 'bg-success-fg', label: 'Online', animate: true }
}

/**
 * Badge de status do sincronizador.
 * Wrapper sobre o padrão visual do LiveIndicator (ponto + texto).
 * NÃO modifica o LiveIndicator original (lição FE-007).
 * aria-live="polite" para leitores de tela.
 */
export function SyncStatusBadge({ isOnline, lastStatus, className }: SyncStatusBadgeProps) {
  const config = getConfig(isOnline, lastStatus)

  return (
    <span
      aria-live="polite"
      aria-label={`Status do sincronizador: ${config.label}`}
      className={clsx('flex items-center gap-1.5 text-xs text-muted', className)}
    >
      <span
        aria-hidden="true"
        className={clsx(
          'h-2 w-2 rounded-full shrink-0',
          config.dotClass,
          config.animate && 'animate-pulse',
        )}
      />
      <span>{config.label}</span>
    </span>
  )
}
