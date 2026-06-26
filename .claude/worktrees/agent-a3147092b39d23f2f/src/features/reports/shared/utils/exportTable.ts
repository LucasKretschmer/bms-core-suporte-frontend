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

function escapeCell(value: string): string {
  // Escapa aspas duplas e remove quebras de linha para CSV seguro
  return value.replace(/"/g, '""').replace(/[\r\n]+/g, ' ')
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

  // Dados
  rows.forEach((row) => {
    sheet.addRow(columns.map((c) => row[c.key] ?? ''))
  })

  // Download
  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  downloadBlob(blob, `${filename}.xlsx`)
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
