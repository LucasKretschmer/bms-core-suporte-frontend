/**
 * Funções puras de contraste WCAG (luminância relativa) — extraídas de
 * `features/reports/appointments/statusColors.ts` (120, análise §4.3) para
 * ficarem importáveis por `components/ui/**` sem inverter a direção de
 * dependência (um componente de nível de app não pode importar de dentro de
 * uma feature). `statusColors.ts` passa a reexportar `contrastRatio` daqui —
 * zero mudança de comportamento nos consumidores existentes.
 */

/** Converte "#rrggbb" em [r,g,b] (0–255). Lança em formato inválido — nunca silencioso. */
export function hexToRgb(hex: string): [number, number, number] {
  const normalized = hex.replace('#', '')
  if (normalized.length !== 6 || /[^0-9a-fA-F]/.test(normalized)) {
    throw new Error(`Cor hex inválida: "${hex}"`)
  }
  const value = Number.parseInt(normalized, 16)
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255]
}

/** Canal sRGB (0–255) → componente linear, conforme WCAG 2.x. */
export function srgbChannelToLinear(channel: number): number {
  const c = channel / 255
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

/** Luminância relativa (WCAG 2.x) de uma cor "#rrggbb". */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex)
  const [rl, gl, bl] = [r, g, b].map(srgbChannelToLinear)
  return 0.2126 * rl + 0.7152 * gl + 0.0722 * bl
}

/**
 * Razão de contraste WCAG entre duas cores sólidas "#rrggbb".
 * `(L1 + 0.05) / (L2 + 0.05)`, com L1 = luminância mais clara.
 */
export function contrastRatio(fgHex: string, bgHex: string): number {
  const l1 = relativeLuminance(fgHex)
  const l2 = relativeLuminance(bgHex)
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}
