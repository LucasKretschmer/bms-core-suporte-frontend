import { clsx } from 'clsx'

type BadgeProps = {
  value: string
  className?: string
}

/**
 * Badge com mapa dinâmico de cores (não switch que quebre em valor novo).
 * Fallback neutro para valores desconhecidos — nunca quebra.
 */

type BadgeStyle = { bg: string; fg: string }

// Mapa de valores conhecidos → classes de estilo
// Usamos classes Tailwind inline para não precisar de CSS customizado por valor
const BADGE_MAP: Record<string, BadgeStyle> = {
  'Plano de Suporte': { bg: 'bg-badge-plano-bg', fg: 'text-badge-plano-fg' },
  'Faturado':         { bg: 'bg-badge-faturado-bg', fg: 'text-badge-faturado-fg' },
  'Não faturado':     { bg: 'bg-badge-nao-faturado-bg', fg: 'text-badge-nao-faturado-fg' },
}

const FALLBACK: BadgeStyle = { bg: 'bg-badge-neutro-bg', fg: 'text-badge-neutro-fg' }

export function Badge({ value, className }: BadgeProps) {
  const style = BADGE_MAP[value] ?? FALLBACK

  return (
    <span
      aria-label={value}
      className={clsx(
        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
        style.bg,
        style.fg,
        className,
      )}
    >
      {value}
    </span>
  )
}
