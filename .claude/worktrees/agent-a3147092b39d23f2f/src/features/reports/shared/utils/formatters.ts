import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'

/**
 * Formatadores de exibição — funções puras.
 * Sempre usa Intl.DateTimeFormat / Intl.NumberFormat (pt-BR) ou date-fns.
 * Nunca manipulação manual de data ou string.
 */

/** Segundos → "Xh Ym" (ex: 3723 → "1h 2m") */
export function formatSeconds(seconds: number): string {
  if (seconds < 0) seconds = 0
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return `${h}h ${m}m`
}

/** Segundos → horas decimais (ex: 3600 → 1.0) */
export function secondsToHours(seconds: number): number {
  return seconds / 3600
}

/** Horas decimais → "Xh Ym" (ex: 1.5 → "1h 30m") */
export function formatHours(hours: number): string {
  const totalSeconds = Math.round(hours * 3600)
  return formatSeconds(totalSeconds)
}

/** ISO Z → data brasileira "dd/MM/yyyy" */
export function formatDate(isoString: string): string {
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: 'America/Sao_Paulo',
    }).format(new Date(isoString))
  } catch {
    return '—'
  }
}

/** ISO Z → data e hora brasileiras "dd/MM/yyyy HH:mm" */
export function formatDateTime(isoString: string): string {
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Sao_Paulo',
    }).format(new Date(isoString))
  } catch {
    return '—'
  }
}

/** ISO Z → hora brasileira "HH:mm" (fuso America/Sao_Paulo) */
export function formatTime(isoString: string): string {
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Sao_Paulo',
    }).format(new Date(isoString))
  } catch {
    return '—'
  }
}

/** YYYY-MM → "Março 2024" (capitalizado) */
export function formatMonth(yearMonth: string): string {
  try {
    const date = parseISO(`${yearMonth}-01`)
    const formatted = format(date, 'MMMM yyyy', { locale: ptBR })
    return formatted.charAt(0).toUpperCase() + formatted.slice(1)
  } catch {
    return yearMonth
  }
}

/** Percentual com 1 casa decimal (ex: 85.3 → "85,3%") — null → "—" */
export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  return new Intl.NumberFormat('pt-BR', {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value / 100)
}

/** Moeda BRL */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

/**
 * Nome do cliente para exibição.
 * Preferência: nomeFantasia → razaoSocial → "—"
 */
export function formatClientName(item: {
  nomeFantasia?: string | null
  razaoSocial?: string | null
}): string {
  return item.nomeFantasia ?? item.razaoSocial ?? '—'
}

/** Número com 1 casa decimal ou "—" se null */
export function formatDecimal(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value)
}
