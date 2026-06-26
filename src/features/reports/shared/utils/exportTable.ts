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

export type ExportRow = Record<string, string | number | null | undefined>
export type ExportColumn = { header: string; key: string }

// ── CSV ──────────────────────────────────────────────────────────────────────

export function exportToCsv(filename: string, columns: ExportColumn[], rows: ExportRow[]): void {
  const headers = columns.map((c) => `"${escapeCell(c.header)}"`).join(',')
  const body = rows
    .map((row) =>
      columns.map((c) => `"${escapeCell(String(row[c.key] ?? ''))}"` ).join(','),
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
  rows.forEach((row) => {
    sheet.addRow(columns.map((c) => sanitizeXlsxCell(row[c.key])))
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
