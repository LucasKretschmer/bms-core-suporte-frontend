import { clsx } from 'clsx'

type SkeletonProps = {
  lines?: number
  height?: string
  className?: string
}

/** Skeleton de carregamento — exibe barras animadas enquanto os dados carregam. */
export function Skeleton({ lines = 5, height = 'h-10', className }: SkeletonProps) {
  return (
    <div
      aria-busy="true"
      aria-label="Carregando…"
      className={clsx('space-y-3 w-full', className)}
    >
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className={clsx(
            'animate-pulse bg-border rounded-[5px] w-full',
            height,
            // Variar o comprimento para parecer mais natural
            i % 3 === 0 ? 'w-full' : i % 3 === 1 ? 'w-4/5' : 'w-3/5',
          )}
        />
      ))}
    </div>
  )
}
