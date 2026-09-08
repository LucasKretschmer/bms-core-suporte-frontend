import { clsx } from 'clsx'
import { formatDuration } from '../../../utils/formatDuration'

type DurationLabelProps = {
  /** 129 — aceita a chave AUSENTE do wire (`WhenWritingNull`), não só `null`. */
  duracaoMs: number | null | undefined
  className?: string
}

/**
 * Exibe duração em ms formatada de forma legível.
 * Lógica de formatação em utils/formatDuration (testável de forma isolada).
 */
export function DurationLabel({ duracaoMs, className }: DurationLabelProps) {
  return (
    <span className={clsx('text-xs text-foreground/70', className)}>
      {formatDuration(duracaoMs)}
    </span>
  )
}
