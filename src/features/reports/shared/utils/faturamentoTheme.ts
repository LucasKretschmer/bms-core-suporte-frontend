/**
 * 121/FAT-5 (A2/D2) — cores das superfícies novas de faturamento.
 *
 * Duas responsabilidades, de propósito no mesmo arquivo:
 *  1. as CLASSES Tailwind (por token, nunca hex) usadas pelo badge "Na fatura" e
 *     pelo card de exceções;
 *  2. o INVENTÁRIO dos pares (texto sobre fundo) que a entrega introduz ou
 *     reaproveita, com o hex espelhado — insumo do teste de contraste.
 *
 * Por que o hex aparece aqui: jsdom/Vitest não resolve `var(--color-*)` sem o CSS
 * real carregado (mesma limitação já documentada em `appointments/statusColors.ts`).
 * Para que os dois lados não divirjam em silêncio, o teste companheiro LÊ
 * `src/styles/global.css` (e o `styles.css` do design system, para os tokens
 * reaproveitados) e exige que cada hex abaixo seja idêntico ao do CSS — o
 * inventário não é mantido à mão nas duas pontas (`rules/security.md` §
 * enumeração que dá poder a um invariante).
 */

/** Par de cor auditável: texto (`fg`) sobre fundo (`bg`), identificado pelos tokens. */
export type ParDeContraste = {
  /** Rótulo humano — aparece na mensagem de falha do teste. */
  label: string
  fgToken: string
  bgToken: string
  /** Hex espelhado do CSS. O teste confere a igualdade com o arquivo real. */
  fg: string
  bg: string
}

/**
 * Todo par de cores usado pelas superfícies novas desta entrega.
 * `4.5:1` é piso inviolável (`rules/frontend.md` § Contraste) — inclusive para os
 * pares REAPROVEITADOS: "já existia" não é medição.
 */
export const FATURA_CONTRAST_PAIRS: ParDeContraste[] = [
  // ── Novos (aditivos) ──
  {
    label: 'badge "Na fatura: Sim"',
    fgToken: '--color-fatura-sim-fg',
    bgToken: '--color-fatura-sim-bg',
    fg: '#046b04',
    bg: '#ddffdd',
  },
  {
    label: 'badge "Na fatura: Não"',
    fgToken: '--color-fatura-nao-fg',
    bgToken: '--color-fatura-nao-bg',
    fg: '#4a5a68',
    bg: '#f0f4f7',
  },
  {
    label: 'card de exceções — título/contagem',
    fgToken: '--color-excecao-fatura-fg',
    bgToken: '--color-excecao-fatura-bg',
    fg: '#8a3d00',
    bg: '#fffbef',
  },
  // ── Reaproveitados pela tela nova (medidos, não herdados por associação) ──
  {
    label: 'card de exceções — subtexto (foreground sobre o fundo de alerta)',
    fgToken: '--color-foreground',
    bgToken: '--color-excecao-fatura-bg',
    fg: '#002f4f',
    bg: '#fffbef',
  },
  {
    // Cobre também o rótulo da ABA INATIVA do modal (mesmo par: muted sobre card).
    label: 'texto secundário e aba inativa (muted sobre card)',
    fgToken: '--color-muted',
    bgToken: '--color-card',
    fg: '#666666',
    bg: '#ffffff',
  },
  {
    label: 'aba ativa do modal (primary sobre card)',
    fgToken: '--color-primary',
    bgToken: '--color-card',
    fg: '#002f4f',
    bg: '#ffffff',
  },
]

/** Classes do badge "Na fatura" — por token, nunca hex (rules/frontend.md § Estilos). */
export const NA_FATURA_CLASSES = {
  sim: 'bg-fatura-sim-bg text-fatura-sim-fg',
  nao: 'bg-fatura-nao-bg text-fatura-nao-fg',
} as const

/** Classes do card de exceções de faturamento (estado "há exceções"). */
export const EXCECAO_FATURA_CLASSES = {
  surface: 'bg-excecao-fatura-bg border-excecao-fatura-fg/40',
  accent: 'text-excecao-fatura-fg',
} as const
