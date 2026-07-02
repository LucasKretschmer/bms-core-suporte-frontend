import { isValid, lastDayOfMonth, parseISO, set } from 'date-fns'

/**
 * Validação de datas compartilhada (date-fns).
 *
 * Usada pelo PeriodFilter (De/Até) e por qualquer tela que precise validar um
 * intervalo antes de disparar a query. Sem lógica manual de dias-por-mês —
 * tudo via date-fns.
 *
 * Formatos suportados nas comparações de range:
 *  - `YYYY-MM-DD` (PeriodFilter mode="date")
 *  - `YYYY-MM`    (PeriodFilter mode="month")
 *
 * Comparação de data pura, sem conversão de fuso (nunca `toISOString()`, que é
 * UTC e causa off-by-one em America/Sao_Paulo perto da meia-noite).
 */

/** Regex de data completa `YYYY-MM-DD`. */
const FULL_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/

/**
 * Verifica se o intervalo é válido.
 *
 * Retorna `true` se qualquer extremo for nulo/vazio (intervalo aberto é válido)
 * ou se `from <= to`. Retorna `false` apenas quando ambos estão presentes e
 * `from > to`.
 *
 * Strings ISO (`YYYY-MM-DD` e `YYYY-MM`) são lexicograficamente ordenáveis, o
 * que permite comparar diretamente sem depender de parse/fuso. Mesmo assim,
 * tratamos ambos os formatos de forma explícita.
 */
export function isRangeValid(from: string | null | undefined, to: string | null | undefined): boolean {
  if (!from || !to) return true
  // Comparação lexicográfica: válida para YYYY-MM-DD e YYYY-MM (formatos ISO
  // ordenáveis como texto). Ex.: '2026-06' <= '2026-07', '2026-06-30' <= '2026-07-01'.
  return from <= to
}

/**
 * Corrige um dia impossível para o último dia válido do mês.
 *
 * Ex.: `2026-06-31` → `2026-06-30`, `2025-02-29` → `2025-02-28` (ano não bissexto).
 * Idempotente para datas já válidas (`2026-06-15` → `2026-06-15`).
 *
 * Aceita apenas o formato `YYYY-MM-DD`. Para qualquer entrada que não seja uma
 * data completa parseável (vazio, `YYYY-MM`, texto solto), retorna a string
 * original inalterada — o chamador decide o que fazer.
 *
 * Usa `lastDayOfMonth` + `set` do date-fns — nunca aritmética manual de dias.
 */
export function clampDayToMonth(iso: string): string {
  const match = FULL_DATE_RE.exec(iso)
  if (!match) return iso

  const year = Number(match[1])
  const month = Number(match[2]) // 1-12
  const day = Number(match[3])

  // Mês fora do intervalo válido — não há como clampar de forma segura.
  if (month < 1 || month > 12) return iso
  if (day < 1) return iso

  // Constrói o primeiro dia do mês (dia 1 sempre existe) para descobrir o
  // último dia real do mês via date-fns.
  const firstOfMonth = set(new Date(year, 0, 1), { month: month - 1, date: 1, hours: 0, minutes: 0, seconds: 0, milliseconds: 0 })
  if (!isValid(firstOfMonth)) return iso

  const maxDay = lastDayOfMonth(firstOfMonth).getDate()
  const clampedDay = Math.min(day, maxDay)

  return formatFullDate(year, month, clampedDay)
}

/** Formata ano/mês/dia (numéricos) em `YYYY-MM-DD` com zero-padding. */
function formatFullDate(year: number, month: number, day: number): string {
  const yyyy = String(year).padStart(4, '0')
  const mm = String(month).padStart(2, '0')
  const dd = String(day).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

/**
 * Normaliza um valor de campo de data no commit.
 *
 * Se o valor for uma data completa (`YYYY-MM-DD`) parseável mas com dia
 * impossível, retorna a versão corrigida (clamp). Caso contrário (vazio,
 * `YYYY-MM`, ou já válido) retorna o valor original.
 *
 * `parseISO` é usado apenas para detectar se a string representa uma data
 * real; a correção em si é feita por `clampDayToMonth`.
 */
export function normalizeDateOnCommit(value: string | null): string | null {
  if (!value) return value
  if (!FULL_DATE_RE.test(value)) return value

  const clamped = clampDayToMonth(value)
  if (clamped !== value) return clamped

  // Já é `YYYY-MM-DD` válido? parseISO confirma (defesa extra).
  return isValid(parseISO(value)) ? value : value
}
