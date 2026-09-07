import { Badge as DsBadge } from '@migrate/design-system'
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
  /**
   * Estilo inline opcional. Reservado para exceções pontuais ao design system
   * (ex.: destaque `tomato` de categoria Invoicy, 107). Sobrepõe as classes de
   * cor por token. Uso normal deve seguir os tokens — não abusar deste escape.
   */
  style?: React.CSSProperties
}

/**
 * Badge com mapa dinâmico de cores (não switch que quebre em valor novo).
 * Fallback neutro para valores desconhecidos — nunca quebra.
 *
 * Wrapper sobre o DS `Badge`: usado só como casca visual (pill, tipografia,
 * padding) — o mapa de cores continua sendo do app (7 valores conhecidos +
 * fallback), pois já é dinâmico e correto por design. Não passamos `tone`/
 * `variant` do DS (usa os defaults); as classes de cor do mapa sobrescrevem
 * via `cn`/tailwind-merge internos do DS por virem depois no `className`.
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
  // Descartado (120, D-1) — entrada 100% ADITIVA, família violeta inédita (não colide com
  // nenhum status existente). Contraste medido 7.39:1 (AA, ver global.css).
  // Nota histórica: quando esta entrada foi escrita, 'Pausado' (`--color-warning-fg`,
  // 3.00:1) e 'Cancelado' (`--color-error-fg`, 3.24:1) tinham débito de contraste
  // conhecido (AP-FRONTEND-018) e o comentário mandava não alterá-las. Os DOIS tokens
  // foram escurecidos desde então — erro para #c00000 em 123/FE-A2 e aviso para #a85800
  // em 125/FE-A11Y-3 — e hoje TODAS as entradas deste mapa atendem AA, medidas no DOM
  // por `src/utils/primitivosDeUiContraste.test.tsx` (sem allowlist de dívida).
  'Descartado':       { bg: 'bg-status-descartado-bg', fg: 'text-status-descartado-fg' },
  // Origem do apontamento (057, visão por cliente combinada) — tokens dedicados
  'Projeto':          { bg: 'bg-badge-origem-projeto-bg', fg: 'text-badge-origem-projeto-fg' },
  'Ticket':           { bg: 'bg-badge-origem-ticket-bg', fg: 'text-badge-origem-ticket-fg' },
}

const FALLBACK: BadgeStyle = { bg: 'bg-badge-neutro-bg', fg: 'text-badge-neutro-fg' }

export function Badge({ value, className, truncate = false, style }: BadgeProps) {
  const tone = BADGE_MAP[value] ?? FALLBACK

  return (
    <DsBadge
      aria-label={value}
      // title só quando truncado: garante o valor completo via tooltip nativo
      title={truncate ? value : undefined}
      style={style}
      className={clsx(truncate && 'max-w-full truncate', tone.bg, tone.fg, className)}
    >
      {value}
    </DsBadge>
  )
}
