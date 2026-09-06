/**
 * MELH-01 — cor do badge de Status por `statusCategoria` (vindo do backend).
 *
 * Função pura e testável, sem parse de texto de label — a cor NUNCA deriva de
 * `status` (texto livre do HubSpot), só de `statusCategoria` (whitelist fechada
 * do banco: aberto | emandamento | fechado | cancelado). D5/D11 (tracker 119).
 */

import type { TicketStatusCategoria } from '../shared/types/reports'
import { contrastRatio } from '../../../utils/colorContrast'

// Reexportado para não quebrar os imports existentes (`./statusColors`) — a
// implementação vive agora em `src/utils/colorContrast.ts` (120, análise §4.3),
// importável também por `components/ui/**` sem inverter a direção de dependência.
export { contrastRatio }

export type StatusTone = { color: string; backgroundColor: string }

/**
 * Mapa fixo por categoria — 4 valores fechados (whitelist do banco).
 *
 * `aberto`/`cancelado` usam tokens NOVOS e aditivos (`--color-status-*`, ver
 * `src/styles/global.css`) — D11: o token compartilhado `--color-warning-fg`
 * (#e07600 sobre #fffbef = 3.00:1) reprova AA (4.5:1) como texto pequeno (12px)
 * sobre o próprio `-bg` e não pode ser alterado (compartilhado por `Badge.tsx`
 * em outras telas, ex. status "Pausado"). `--color-error-fg` reprovava junto
 * (3.24:1) quando este mapa foi escrito; em 123/FE-A2 ele foi escurecido de
 * `#ff0000` para `#c00000` e hoje passa (5.24:1 sobre `--color-error-bg`) — os
 * tokens `--color-status-*` continuam, porque carregam fundo próprio por status.
 * `info` (7.82:1) e `success` (4.75:1) já passam — reaproveitam os existentes.
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
