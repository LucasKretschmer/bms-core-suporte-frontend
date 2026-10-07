import { formatSeconds } from '../shared/utils/formatters'

/** Marcador de valor ausente nesta tela (chave omitida no wire ou nula). */
export const VALOR_AUSENTE = '-'

/** Número com casas fixas em pt-BR, ou o marcador de ausente. */
export function formatNumeroOpcional(value: number | null | undefined, casas = 0): string {
  if (value == null) return VALOR_AUSENTE
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  }).format(value)
}

/**
 * Mesmo número para a exportação: ausente vira célula vazia. O "-" da tela não serve
 * aqui, porque o sanitizador de fórmula trata "-" inicial como fórmula e grava `'-`.
 */
export function formatNumeroExport(value: number | null | undefined, casas = 0): string {
  return value == null ? '' : formatNumeroOpcional(value, casas)
}

/** Segundos no formato "Xh Ym" da tela, ou o marcador de ausente. */
export function formatSegundosOpcional(value: number | null | undefined): string {
  if (value == null) return VALOR_AUSENTE
  return formatSeconds(value)
}

/** Texto do tooltip do alerta de jornada: apontado x horas úteis. */
export function textoApontadoVersusUteis(
  totalSegundos: number,
  horasUteisSegundos: number | null | undefined,
): string {
  return `Apontado ${formatSeconds(totalSegundos)} de ${formatSegundosOpcional(horasUteisSegundos)} úteis`
}

/** Fundo da linha que passou do limite (jornada ou apontamento). */
export const CLASSE_LINHA_ACIMA_DO_LIMITE = 'bg-error-bg'

export const TEXTO_ACIMA_DA_JORNADA = 'Acima da jornada'
