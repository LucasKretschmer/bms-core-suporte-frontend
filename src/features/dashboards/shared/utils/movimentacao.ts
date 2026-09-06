/**
 * Utilitários puros para a seção de Movimentação Diária (#1 da demanda 010).
 *
 * Distinção honesta de empty state: "não há dias retornados" é diferente de
 * "há dias retornados, mas todas as séries somam zero". Ambos resultam em um
 * gráfico sem informação útil — devem cair no mesmo empty state honesto, sem
 * parecer que o gráfico está quebrado.
 */

import type { DailyDataPointDto } from '../types/metrics'

export type SerieMovimentacao = {
  /** Chave da série — a mesma `dataKey` do gráfico e do DTO diário. */
  key: keyof Omit<DailyDataPointDto, 'data'>
  /** Rótulo PT-BR exibido na legenda e no tooltip — nunca categoria HubSpot. */
  label: string
  /** Token de cor no `@theme` (via `chartTokens`) — nunca hex literal. */
  tokenKey:
    | 'chart-novos'
    | 'chart-andamento'
    | 'chart-resolvidos'
    | 'chart-cancelados'
    | 'chart-aberto'
}

/**
 * Enumeração das séries da Movimentação Diária — identidade estável (chave, rótulo, cor).
 *
 * Vive aqui, e não no componente, por duas razões: é dado, não UI (o `react-refresh` do
 * ESLint reprova constante exportada de arquivo de componente), e assim o teste pode
 * travar **quais** séries existem sem montar gráfico nenhum.
 */
export const MOVIMENTACAO_SERIES: readonly SerieMovimentacao[] = [
  { key: 'novos', label: 'Novos', tokenKey: 'chart-novos' },
  { key: 'emAndamento', label: 'Em atendimento', tokenKey: 'chart-andamento' },
  { key: 'resolvidos', label: 'Resolvidos', tokenKey: 'chart-resolvidos' },
  { key: 'cancelados', label: 'Cancelados', tokenKey: 'chart-cancelados' },
  { key: 'emAberto', label: 'Em aberto', tokenKey: 'chart-aberto' },
]

/**
 * 123/D3a — texto exibido quando o período tem UM único dia.
 * Ancorado em `data.length === 1`: afirma só o que é verificável no próprio dado
 * (AP-FRONTEND-022 — texto de UI que afirma comportamento do sistema é código).
 */
export const AVISO_PONTO_UNICO =
  'Período de um único dia: cada série aparece como um ponto — não há linha a traçar.'

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
