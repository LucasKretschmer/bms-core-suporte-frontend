/**
 * Utilitários puros para a seção de Movimentação Diária (#1 da demanda 010).
 *
 * Distinção honesta de empty state: "não há dias retornados" é diferente de
 * "há dias retornados, mas todas as séries somam zero". Ambos resultam em um
 * gráfico sem informação útil — devem cair no mesmo empty state honesto, sem
 * parecer que o gráfico está quebrado.
 */

import type { DailyDataPointDto } from '../types/metrics'

/**
 * Retorna `true` se houver QUALQUER movimentação no período — isto é, ao menos
 * um ponto diário com pelo menos uma série maior que zero.
 *
 * Função pura — alvo de teste (AP-FRONTEND-006: testar lógica pura, não o render).
 */
export function temMovimento(days: DailyDataPointDto[]): boolean {
  return days.some(
    (d) =>
      d.novos > 0 ||
      d.emAndamento > 0 ||
      d.resolvidos > 0 ||
      d.cancelados > 0 ||
      d.emAberto > 0,
  )
}

/**
 * Empty honesto da movimentação: sem dias OU dias todos-zero.
 * Só é considerado vazio quando não está carregando nem em erro.
 */
export function isMovimentacaoEmpty(
  days: DailyDataPointDto[],
  isLoading: boolean,
  isError: boolean,
): boolean {
  if (isLoading || isError) return false
  return days.length === 0 || !temMovimento(days)
}
