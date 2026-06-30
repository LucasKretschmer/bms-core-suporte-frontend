import { clsx } from 'clsx'

type BadgeProps = {
  value: string
  className?: string
  /**
   * Quando true, limita o texto a uma linha com reticências (`truncate`).
   * Combine com uma classe de largura máxima em `className` (ex.: `max-w-[140px]`).
   * O valor completo fica acessível via `title`/`aria-label`.
   */
  truncate?: boolean
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
  // Status do atendimento (apontamento) — cores via tokens semânticos de alerta
  'Em andamento':     { bg: 'bg-info-bg', fg: 'text-info-fg' },
  'Pausado':          { bg: 'bg-warning-bg', fg: 'text-warning-fg' },
  'Concluído':        { bg: 'bg-success-bg', fg: 'text-success-fg' },
  'Cancelado':        { bg: 'bg-error-bg', fg: 'text-error-fg' },
  // Origem do apontamento (057, visão por cliente combinada) — tokens dedicados
  'Projeto':          { bg: 'bg-badge-origem-projeto-bg', fg: 'text-badge-origem-projeto-fg' },
  'Ticket':           { bg: 'bg-badge-origem-ticket-bg', fg: 'text-badge-origem-ticket-fg' },
}

const FALLBACK: BadgeStyle = { bg: 'bg-badge-neutro-bg', fg: 'text-badge-neutro-fg' }

export function Badge({ value, className, truncate = false }: BadgeProps) {
  const style = BADGE_MAP[value] ?? FALLBACK

  return (
    <span
      aria-label={value}
      // title só quando truncado: garante o valor completo via tooltip nativo
      title={truncate ? value : undefined}
      className={clsx(
        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
        truncate && 'max-w-full truncate',
        style.bg,
        style.fg,
        className,
      )}
    >
      {value}
    </span>
  )
}
