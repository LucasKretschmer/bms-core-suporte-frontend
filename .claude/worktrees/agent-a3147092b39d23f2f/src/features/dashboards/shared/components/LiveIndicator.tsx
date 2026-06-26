import { clsx } from 'clsx'

type StreamStatus = 'connecting' | 'open' | 'error' | 'closed'

type LiveIndicatorProps = {
  status: StreamStatus
  className?: string
}

const STATUS_CONFIG: Record<
  StreamStatus,
  { dotClass: string; label: string; animate: boolean }
> = {
  open: {
    dotClass: 'bg-success-fg',
    label: 'ao vivo',
    animate: true,
  },
  connecting: {
    dotClass: 'bg-warning-fg',
    label: 'conectando…',
    animate: false,
  },
  error: {
    dotClass: 'bg-muted',
    label: 'offline',
    animate: false,
  },
  closed: {
    dotClass: 'bg-muted',
    label: 'offline',
    animate: false,
  },
}

/**
 * Indicador de conexão SSE.
 * open → ponto verde animado (pulsa).
 * connecting → ponto âmbar estático.
 * error/closed → ponto cinza.
 * aria-live="polite" para leitores de tela.
 */
export function LiveIndicator({ status, className }: LiveIndicatorProps) {
  const config = STATUS_CONFIG[status]

  return (
    <span
      aria-live="polite"
      aria-label={`Status da conexão: ${config.label}`}
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
