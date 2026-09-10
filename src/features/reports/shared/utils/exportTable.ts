/**
 * Utilitários de export CSV e Excel.
 * Usa exceljs para .xlsx (mais seguro que sheetjs — vide security.md).
 * CSV gerado sem dependência extra (string + Blob).
 *
 * PRIVACIDADE: a função recebe exatamente as colunas da ColumnDef da tela.
 * O mapeamento garante que campos internos (categoria HubSpot) nunca apareçam.
 *
 * EXPORT COMPLETO: o chamador deve passar dados de todas as páginas.
 * Nunca exportar silenciosamente só a página visível.
 */

import { hoursToSeconds } from './formatters'

/** Valor de célula de coluna comum. */
export type ExportCellValue = string | number | null | undefined
export type ExportRow = Record<string, ExportCellValue>

/**
 * Tipo declarado da coluna. Ausente ⇒ 'text' (comportamento anterior, bit-a-bit).
 * 'duration' ⇒ a célula desta coluna traz DURAÇÃO EM SEGUNDOS (número inteiro ≥ 0),
 * ou `null` para ausência. NUNCA texto pré-formatado — quem converte é a origem,
 * por um dos três helpers (`durationCell`, `durationCellFromHours`,
 * `durationCellFromMillis`), nunca à mão.
 */
export type ExportColumnType = 'text' | 'duration'

export type ExportColumn = {
  header: string
  key: string
  /** Ver `ExportColumnType`. Omitir em coluna de texto — não escrever `type: 'text'`. */
  type?: ExportColumnType
}

// ── Duração (demanda 134) ─────────────────────────────────────────────────────

/** Formato numérico do Excel para duração acumulável: builtin numFmtId 46. */
const DURATION_NUM_FMT = '[h]:mm:ss'
const SECONDS_PER_DAY = 86_400

/**
 * Guard de ausência das colunas de duração — mora AQUI, uma única vez, e não em
 * cada call site (`AP-ARQUITETURA-005`).
 *
 * `== null` e NUNCA `=== undefined`: o valor atravessa a rede e `null` e ausência são o
 * mesmo fato para quem consome (`AP-FRONTEND-028`).
 * NaN/±Infinity = desconhecido, não zero. `0` é valor, não ausência — por isso nenhum
 * ramo pode ser `if (!v)`. Negativo clampa em 0 (é o que a tela já exibe hoje, e o Excel
 * não exibe tempo negativo com `[h]:mm:ss`).
 *
 * 🔴 **O `value == null` daqui é REDUNDANTE POR CONSTRUÇÃO — e isso está escrito de
 * propósito** (achado I-01 do QA da 134, confirmado por mutação pela U12): para toda entrada
 * em que ele dispara, `Number.isFinite(value)` da linha seguinte já é `false` e devolveria o
 * mesmo `null`. Apagá-lo deixa a suíte inteira verde, e **isso não é buraco de cobertura**:
 * é um ramo dominado, indetectável por qualquer teste de caixa-preta. Fica por ser guard de
 * ausência explícito, barato e correto — mas **ninguém deve acreditar que existe teste aqui**.
 * Onde o mesmo guard é CARGA REAL é em `normalizeDurationSeconds` (abaixo), porque lá o
 * `typeof value !== 'number'` vem ANTES do `Number.isFinite` e `null` cairia no fallback
 * ruidoso — quem trava aquele é N15 (CSV, espião de lista) e N19 (XLSX relido).
 */
function coerceDurationCell(
  value: number | null | undefined,
  toSeconds: (v: number) => number,
): number | null {
  if (value == null) return null
  if (!Number.isFinite(value)) return null
  return Math.max(0, Math.round(toSeconds(value)))
}

/** Segundos → célula de duração. Ausente/NaN/Infinity → `null`. Negativo → 0. */
export function durationCell(seconds: number | null | undefined): number | null {
  return coerceDurationCell(seconds, (v) => v)
}

/** Horas decimais → célula de duração (segundos). Mesmas regras de ausência. */
export function durationCellFromHours(hours: number | null | undefined): number | null {
  return coerceDurationCell(hours, hoursToSeconds)
}

/** Milissegundos → célula de duração (segundos). Mesmas regras de ausência. */
export function durationCellFromMillis(ms: number | null | undefined): number | null {
  return coerceDurationCell(ms, (v) => v / 1000)
}

/**
 * Segundos → "H:mm:ss" com zero à esquerda nas horas < 10 e **sem módulo 24**
 * (95400 → "26:30:00"). Exportada para teste unitário puro — é a MESMA função que
 * `exportToCsv` usa, não um caminho paralelo.
 */
export function formatDurationCsv(seconds: number): string {
  const total = Math.max(0, Math.round(seconds))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/**
 * Segundos → fração de dia (serial de tempo do Excel), o valor NUMÉRICO da célula.
 * Sem módulo 24: 95400 s → 1,1041667 (mais de um dia). Exportada para teste unitário.
 */
export function durationToExcelSerial(seconds: number): number {
  return Math.max(0, Math.round(seconds)) / SECONDS_PER_DAY
}

/**
 * Normaliza o valor bruto de uma célula de coluna `duration`.
 *  - number finito  → segundos inteiros, clampado em 0
 *  - null/undefined → `null` (ausência ⇒ célula vazia nos dois formatos)
 *  - qualquer outra coisa (string!) → `undefined` = "não é duração", cai no FALLBACK
 */
function normalizeDurationSeconds(value: ExportCellValue): number | null | undefined {
  if (value == null) return null
  if (typeof value !== 'number') return undefined
  if (!Number.isFinite(value)) return null
  return Math.max(0, Math.round(value))
}

/**
 * FALLBACK RUIDOSO: coluna marcada `duration` que recebeu texto — sintoma de call site
 * que esqueceu de tirar o `formatSeconds(...)`. O dado NÃO é descartado (célula vazia é
 * perda de dado num artefato que sai do sistema, `AP-FRONTEND-028`): sai pelo caminho de
 * texto, sanitizado, e o erro é gritado em dev. Nunca loga o valor — só a chave da coluna.
 */
function avisarCelulaDeDuracaoNaoNumerica(key: string, value: ExportCellValue): void {
  if (import.meta.env.DEV) {
    console.error(
      `[exportTable] coluna "${key}" está marcada como type:'duration' mas recebeu ` +
        `${typeof value} — exportada como texto. Use durationCell*() no mapper.`,
    )
  }
}

// ── CSV ──────────────────────────────────────────────────────────────────────

export function exportToCsv(filename: string, columns: ExportColumn[], rows: ExportRow[]): void {
  const headers = columns.map((c) => `"${escapeCell(c.header)}"`).join(',')
  const body = rows
    .map((row) =>
      columns.map((c) => `"${escapeCell(csvCellText(c, row[c.key]))}"` ).join(','),
    )
    .join('\n')

  const content = `${headers}\n${body}`
  const blob = new Blob(['﻿' + content], { type: 'text/csv;charset=utf-8;' })
  downloadBlob(blob, `${filename}.csv`)
}

/**
 * Endurece a célula para CSV (A03 — CSV/Formula Injection).
 * - Prefixa com aspa simples toda célula que comece com = + - @ (e tab/CR
 *   iniciais, que o Excel também interpreta como início de fórmula).
 * - Escapa aspas duplas e remove quebras de linha.
 * Dado pode vir de assunto/nome de cliente — entrada hostil até prova em contrário.
 */
/**
 * Texto da célula no CSV, ANTES do `escapeCell` — que continua envolvendo TODAS as
 * células, sem exceção (A03). Não existe ramo que escreva no body sem passar por ele.
 */
function csvCellText(column: ExportColumn, value: ExportCellValue): string {
  if (column.type === 'duration') {
    const seconds = normalizeDurationSeconds(value)
    if (seconds === null) return '' // ausência ⇒ célula vazia. Nunca "—", nunca 0.
    if (seconds !== undefined) return formatDurationCsv(seconds)
    avisarCelulaDeDuracaoNaoNumerica(column.key, value)
  }
  return String(value ?? '')
}

function escapeCell(value: string): string {
  let sanitized = value
  if (/^[=+\-@\t\r]/.test(sanitized)) {
    sanitized = `'${sanitized}`
  }
  return sanitized.replace(/"/g, '""').replace(/[\r\n]+/g, ' ')
}

// ── Excel (.xlsx) ─────────────────────────────────────────────────────────────

export async function exportToXlsx(
  filename: string,
  columns: ExportColumn[],
  rows: ExportRow[],
): Promise<void> {
  // Importação lazy — não pesa o bundle inicial
  const { default: ExcelJS } = await import('exceljs')
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet(filename.substring(0, 31))

  // Cabeçalhos
  sheet.columns = columns.map((c) => ({
    header: c.header,
    key: c.key,
    width: Math.max(c.header.length + 4, 15),
  }))

  // Estilo do cabeçalho
  const headerRow = sheet.getRow(1)
  headerRow.font = { bold: true }
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE2E8F0' },
  }

  // Dados — sanitiza strings contra fórmula (A03); números/null passam direto.
  // Coluna `duration`: célula NUMÉRICA (fração de dia) + numFmt `[h]:mm:ss`, aplicado
  // na CÉLULA (nunca na coluna, que também pintaria o cabeçalho).
  rows.forEach((row) => {
    const excelRow = sheet.addRow(columns.map((c) => xlsxCellValue(c, row[c.key])))
    columns.forEach((c, i) => {
      if (c.type !== 'duration') return
      const cell = excelRow.getCell(i + 1) // 1-based
      if (typeof cell.value === 'number') cell.numFmt = DURATION_NUM_FMT
    })
  })

  // Download
  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  downloadBlob(blob, `${filename}.xlsx`)
}

/**
 * Endurece célula do XLSX (A03 — Formula Injection no Excel).
 * Strings que começam com = + - @ (ou tab/CR) recebem prefixo de aspa simples.
 * Números e null/undefined são mantidos como estão.
 */
/**
 * Valor da célula no XLSX. Coluna `duration` só emite `number` (serial) ou `null`
 * (ausência ⇒ célula ValueType.Null, que SOMA/MÉDIA ignoram) — um número não pode ser
 * fórmula. O fallback de texto vai por `sanitizeXlsxCell`: não há terceira saída (A03).
 */
function xlsxCellValue(column: ExportColumn, value: ExportCellValue): string | number | null {
  if (column.type === 'duration') {
    const seconds = normalizeDurationSeconds(value)
    if (seconds === null) return null
    if (seconds !== undefined) return durationToExcelSerial(seconds)
    avisarCelulaDeDuracaoNaoNumerica(column.key, value)
  }
  return sanitizeXlsxCell(value)
}

function sanitizeXlsxCell(
  value: string | number | null | undefined,
): string | number {
  if (value === null || value === undefined) return ''
  if (typeof value === 'number') return value
  if (/^[=+\-@\t\r]/.test(value)) return `'${value}`
  return value
}

// ── Utilitário de download ────────────────────────────────────────────────────

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener noreferrer'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
