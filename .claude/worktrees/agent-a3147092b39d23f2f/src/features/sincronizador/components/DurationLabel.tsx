import { clsx } from 'clsx'
import { formatDuration } from '../../../utils/formatDuration'

type DurationLabelProps = {
  duracaoMs: number | null
  className?: string
}

/**
 * Exibe duração em ms formatada de forma legível.
 * Lógica de formatação em utils/formatDuration (testável de forma isolada).
 */
export function DurationLabel({ duracaoMs, className }: DurationLabelProps) {
  return (
    <span className={clsx('text-xs text-foreground/60', className)}>
      {formatDuration(duracaoMs)}
    </span>
  )
}
