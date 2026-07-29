/**
 * MELH-01 — cor do badge de Status por `statusCategoria` (vindo do backend).
 *
 * Função pura e testável, sem parse de texto de label — a cor NUNCA deriva de
 * `status` (texto livre do HubSpot), só de `statusCategoria` (whitelist fechada
 * do banco: aberto | emandamento | fechado | cancelado). D5/D11 (tracker 119).
 */

import type { TicketStatusCategoria } from '../shared/types/reports'

export type StatusTone = { color: string; backgroundColor: string }

/**
 * Mapa fixo por categoria — 4 valores fechados (whitelist do banco).
 *
 * `aberto`/`cancelado` usam tokens NOVOS e aditivos (`--color-status-*`, ver
 * `src/styles/global.css`) — D11: os tokens compartilhados `--color-warning-fg`
 * (~3.00:1) e `--color-error-fg` (~3.24:1) reprovam AA (4.5:1) como texto
 * pequeno (12px) sobre o próprio `-bg`; não podiam ser alterados (compartilhados
 * por `Badge.tsx` em outras telas, ex. status "Pausado"/"Cancelado"). `info`
 * (7.82:1) e `success` (4.75:1) já passam — reaproveitam os tokens existentes.
 */
const STATUS_TONE_MAP: Record<TicketStatusCategoria, StatusTone> = {
  aberto: {
    color: 'var(--color-status-aberto-fg)',
    backgroundColor: 'var(--color-status-aberto-bg)',
  },
  emandamento: {
    color: 'var(--color-info-fg)',
    backgroundColor: 'var(--color-info-bg)',
  },
  fechado: {
    color: 'var(--color-success-fg)',
    backgroundColor: 'var(--color-success-bg)',
  },
  cancelado: {
    color: 'var(--color-status-cancelado-fg)',
    backgroundColor: 'var(--color-status-cancelado-bg)',
  },
}

/** Sem categoria (stage antigo/nulo) ou valor desconhecido → neutro, nunca lança. */
const NEUTRAL_TONE: StatusTone = {
  color: 'var(--color-badge-neutro-fg)',
  backgroundColor: 'var(--color-badge-neutro-bg)',
}

/**
 * Override transversal (107) — família tomato, escolha explícita do usuário.
 * D11 item 4: o par original (`tomato` sobre `rgba(255, 99, 71, 0.12)`) reprova
 * AA (~2.6:1 medido) — texto escurecido para `#b31b00` (mesmo matiz/saturação
 * de `tomato`, luminosidade reduzida) preservando o fundo tomate original.
 * Não é token do `global.css` (exceção documentada, mesmo padrão já hardcoded
 * antes em `columns.tsx`); centralizado aqui como única fonte de verdade.
 */
export const INVOICY_TONE: StatusTone = {
  color: '#b31b00',
  backgroundColor: 'rgba(255, 99, 71, 0.12)',
}

/**
 * Tom (cor de texto + fundo) do badge de Status.
 * `isInvoicy` tem prioridade sobre a categoria (mantém o comportamento aprovado
 * na 107, mesmo quando `statusCategoria` também está presente, ex. 'cancelado').
 * Nunca lança: categoria desconhecida/null cai no neutro.
 */
export function statusTone(
  statusCategoria: TicketStatusCategoria | null | undefined,
  isInvoicy: boolean,
): StatusTone {
  if (isInvoicy) return INVOICY_TONE
  if (!statusCategoria) return NEUTRAL_TONE
  return STATUS_TONE_MAP[statusCategoria] ?? NEUTRAL_TONE
}

/** Itens fixos da legenda (D5: legenda fixa, não depende dos dados da página). */
export const STATUS_LEGEND_ITEMS: { key: string; label: string; tone: StatusTone }[] = [
  { key: 'aberto', label: 'Aberto', tone: STATUS_TONE_MAP.aberto },
  { key: 'emandamento', label: 'Em andamento', tone: STATUS_TONE_MAP.emandamento },
  { key: 'fechado', label: 'Fechado', tone: STATUS_TONE_MAP.fechado },
  { key: 'cancelado', label: 'Cancelado', tone: STATUS_TONE_MAP.cancelado },
  { key: 'invoicy', label: 'Fora do consumo (Invoicy)', tone: INVOICY_TONE },
]

// ── Auditoria de contraste (obrigatória — AP-FRONTEND-015/D11) ──────────────
//
// Valores hex abaixo ESPELHAM exatamente os tokens definidos em `global.css`
// (comentados lá também) — mantidos aqui como fonte única para o teste puro
// de contraste (WCAG 2.x, fórmula de luminância relativa), já que jsdom/Vitest
// não resolve `var(--color-*)` sem o CSS real carregado.
//
// O fundo do override Invoicy é `rgba(255, 99, 71, 0.12)`; para medir contraste
// (que exige uma cor sólida) usamos o valor já composto sobre branco/`--color-card`
// (`#ffece9`), que é a aparência real renderizada sobre o fundo do card.
export const CONTRAST_AUDIT_PAIRS: { label: string; fg: string; bg: string }[] = [
  { label: 'aberto', fg: '#a85800', bg: '#fffbef' },
  { label: 'emandamento (info)', fg: '#074b7f', bg: '#dff1fd' },
  { label: 'fechado (success)', fg: '#008000', bg: '#ddffdd' },
  { label: 'cancelado', fg: '#c00000', bg: '#ffe0e0' },
  { label: 'invoicy (override tomato)', fg: '#b31b00', bg: '#ffece9' },
]

/** Converte "#rrggbb" em [r,g,b] (0–255). Lança em formato inválido — nunca silencioso. */
function hexToRgb(hex: string): [number, number, number] {
  const normalized = hex.replace('#', '')
  if (normalized.length !== 6) {
    throw new Error(`Cor hex inválida: "${hex}"`)
  }
  const value = Number.parseInt(normalized, 16)
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255]
}

/** Canal sRGB (0–255) → componente linear, conforme WCAG 2.x. */
function srgbChannelToLinear(channel: number): number {
  const c = channel / 255
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

/** Luminância relativa (WCAG 2.x) de uma cor "#rrggbb". */
function relativeLuminance(hex: string): number {
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
