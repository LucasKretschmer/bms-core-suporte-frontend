import { clsx } from 'clsx'
import type { StatusSistema } from '../types/sincronizador'

type SyncStatusBadgeProps = {
  /** Status agregado calculado pelo backend (não derivar no front). */
  statusSistema: StatusSistema
  className?: string
}

type BadgeConfig = {
  dotClass: string
  label: string
  animate: boolean
}

const STATUS_CONFIG: Record<StatusSistema, BadgeConfig> = {
  online: { dotClass: 'bg-success-fg', label: 'Online', animate: true },
  degradado: { dotClass: 'bg-warning-fg', label: 'Degradado', animate: false },
  offline: { dotClass: 'bg-muted', label: 'Offline', animate: false },
}

/**
 * Badge de status do sincronizador.
 * Consome `statusSistema` (online | degradado | offline) vindo do backend.
 * aria-live="polite" para leitores de tela.
 */
export function SyncStatusBadge({ statusSistema, className }: SyncStatusBadgeProps) {
  const config = STATUS_CONFIG[statusSistema] ?? STATUS_CONFIG.offline

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
