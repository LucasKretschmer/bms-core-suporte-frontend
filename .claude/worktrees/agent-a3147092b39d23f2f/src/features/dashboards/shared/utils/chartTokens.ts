/**
 * Ponte CSS vars → Recharts.
 * Lê tokens de cor do @theme em runtime via getComputedStyle.
 * Chamado uma vez e memoizado. Recharts recebe strings de cor — nunca hex literal.
 * Zero hex hardcoded neste arquivo ou nos componentes que o consomem.
 */

const TOKEN_NAMES = [
  'chart-1',
  'chart-2',
  'chart-3',
  'chart-4',
  'chart-5',
  'chart-6',
  'chart-7',
  'chart-8',
  'chart-novos',
  'chart-andamento',
  'chart-resolvidos',
  'chart-cancelados',
  'chart-aberto',
  'chart-verde',
  'chart-amarelo',
  'chart-vermelho',
] as const

export type TokenName = (typeof TOKEN_NAMES)[number]
export type ChartTokens = Record<TokenName, string>

let cachedTokens: ChartTokens | null = null

/**
 * Retorna objeto com todas as cores de chart definidas no @theme.
 * Memoizado após primeira chamada — getComputedStyle só é chamado uma vez.
 */
export function getChartTokens(): ChartTokens {
  if (cachedTokens) return cachedTokens

  const style = getComputedStyle(document.documentElement)
  cachedTokens = Object.fromEntries(
    TOKEN_NAMES.map((name) => [
      name,
      style.getPropertyValue(`--color-${name}`).trim(),
    ]),
  ) as ChartTokens

  return cachedTokens
}

/**
 * Paleta indexada (1..8) para status/categoria dinâmicos.
 * Índice estável (ordenar dados antes de mapear cor).
 */
export function getChartPalette(): string[] {
  const tokens = getChartTokens()
  return [
    tokens['chart-1'],
    tokens['chart-2'],
    tokens['chart-3'],
    tokens['chart-4'],
    tokens['chart-5'],
    tokens['chart-6'],
    tokens['chart-7'],
    tokens['chart-8'],
  ]
}

/**
 * Invalida o cache de tokens (útil em testes que mudam o tema).
 */
export function resetChartTokensCache(): void {
  cachedTokens = null
}
