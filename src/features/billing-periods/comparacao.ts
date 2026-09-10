import {
  formatHours,
  formatPercent,
} from '../reports/shared/utils/formatters'
import type {
  BillingPeriodComparisonItemDto,
  BillingPeriodComparisonValoresDto,
} from './types/billingPeriod'

/**
 * 132/F7 — a comparação de auditoria (D12 · `arquitetura.md` §8.2), parte pura.
 *
 * Os nove campos vêm do contrato do `BillingPeriodComparisonItemDto`, em **uma** lista
 * nominal: é ela que a tabela percorre e é ela que o teste de identidade trava. Redigitar
 * a lista numa segunda enumeração (as colunas, por exemplo) faria campo novo aparecer num
 * lugar e sumir no outro, em silêncio (`AP-API-002`).
 */
export const CAMPOS_COMPARADOS = [
  'planoBaseHoras',
  'creditoHoras',
  'planoEfetivoHoras',
  'horasUsadas',
  'horasRestantes',
  'horasAdicionais',
  'percentualPlano',
  'horasFaturaveis',
  'horasAnalise',
] as const

export type CampoComparado = (typeof CAMPOS_COMPARADOS)[number]

const CONJUNTO_DE_CAMPOS: ReadonlySet<string> = new Set<string>(CAMPOS_COMPARADOS)

/** `null`/ausente = valor desconhecido ⇒ `'—'`. Nunca `0h 0m`, nunca `0,0%`. */
const TRACO = '—'

/**
 * Formata um campo comparado. `percentualPlano` é percentual (1 casa, como o resto do
 * sistema); os oito restantes são horas decimais.
 */
export function formatarCampoComparado(
  campo: CampoComparado,
  valores: BillingPeriodComparisonValoresDto | null | undefined,
): string {
  if (valores == null) return TRACO
  const valor = valores[campo]
  if (valor == null) return TRACO
  return campo === 'percentualPlano' ? formatPercent(valor) : formatHours(valor)
}

/**
 * O campo está divergente? 🔴 **Quem decide é o servidor** (`camposDivergentes`), nunca
 * uma comparação de números feita aqui: recalcular a divergência no cliente seria uma
 * segunda fonte de verdade sobre um veredito que já foi dado — e com outro
 * arredondamento.
 *
 * `camposDivergentes` ausente/`null` ⇒ nenhum campo é marcado. É "não sei", e marcar por
 * suposição afirmaria uma divergência que ninguém apurou.
 */
export function campoEstaDivergente(
  item: BillingPeriodComparisonItemDto,
  campo: CampoComparado,
): boolean {
  return item.camposDivergentes?.includes(campo) === true
}

/**
 * Nomes vindos em `camposDivergentes` que esta versão do painel **não conhece**.
 *
 * Existem para não sumirem: um campo novo no servidor apareceria como divergência que a
 * tela simplesmente não desenha — a auditoria diria "sem divergência" sobre um mês que
 * tem. Aqui eles são exibidos como texto, com o nome cru do servidor.
 */
export function camposDivergentesDesconhecidos(
  itens: readonly BillingPeriodComparisonItemDto[],
): string[] {
  const desconhecidos = new Set<string>()
  for (const item of itens) {
    for (const campo of item.camposDivergentes ?? []) {
      if (!CONJUNTO_DE_CAMPOS.has(campo)) desconhecidos.add(campo)
    }
  }
  return [...desconhecidos].sort()
}

/**
 * Rótulo da coluna "Divergência". `temDivergencia` ausente/`null` ⇒ `'—'`: dizer "Não"
 * sobre um valor desconhecido é o defeito literal do `AP-FRONTEND-028`.
 */
export function rotuloDeDivergencia(item: BillingPeriodComparisonItemDto): string {
  if (item.temDivergencia == null) return TRACO
  return item.temDivergencia ? 'Sim' : 'Não'
}
