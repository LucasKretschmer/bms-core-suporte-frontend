import { Skeleton as DsSkeleton } from '@migrate/design-system'
import { clsx } from 'clsx'

type SkeletonProps = {
  lines?: number
  height?: string
  className?: string
}

/**
 * Skeleton de carregamento — exibe barras animadas enquanto os dados carregam.
 *
 * Adapter sobre o DS `Skeleton`: o DS renderiza uma única barra (sem conceito
 * de `lines`); o wrapper compõe N `DsSkeleton` com larguras variadas para
 * simular parágrafos, preservando a API local (`lines`/`height`/`className`).
 */
export function Skeleton({ lines = 5, height = 'h-10', className }: SkeletonProps) {
  return (
    <div
      aria-busy="true"
      aria-label="Carregando…"
      className={clsx('space-y-3 w-full', className)}
    >
      {Array.from({ length: lines }).map((_, i) => (
        <DsSkeleton
          key={i}
          className={clsx(
            height,
            // Variar o comprimento para parecer mais natural
            i % 3 === 0 ? 'w-full' : i % 3 === 1 ? 'w-4/5' : 'w-3/5',
          )}
        />
      ))}
    </div>
  )
}
