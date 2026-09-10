import { expect } from 'vitest'
import type { ExportColumn, ExportRow } from '../features/reports/shared/utils/exportTable'

/**
 * Utilitário de teste da demanda 134 (não é `.test.ts` — não contém casos).
 *
 * A enumeração das colunas de duração de cada superfície é **derivada** da declaração
 * real das colunas, nunca mantida à mão (`rules/security.md` § invariante). Cada
 * superfície trava a **identidade literal** do conjunto derivado — cardinalidade passa
 * quando uma coluna entra e outra sai.
 */
export function chavesDeDuracao(columns: ExportColumn[]): string[] {
  return columns.filter((c) => c.type === 'duration').map((c) => c.key)
}

/**
 * Para cada chave derivada, afirma que o mapper devolve `number | null` — nunca
 * `'2h 44m'`. Começa pelos controles positivos: sem eles a asserção seria satisfeita
 * pelo vazio (`rules/tests.md` § padrão 1 — asserção negativa satisfeita pelo vazio).
 */
export function assertCelulasDeDuracaoSaoNumericas(
  columns: ExportColumn[],
  rows: ExportRow[],
): void {
  const chaves = chavesDeDuracao(columns)
  expect(chaves.length).toBeGreaterThan(0)
  expect(rows.length).toBeGreaterThan(0)

  for (const chave of chaves) {
    for (const row of rows) {
      const valor = row[chave]
      expect(
        valor === null || typeof valor === 'number',
        `coluna de duração "${chave}" devolveu ${typeof valor} (${String(valor)}) — ` +
          `esperado number | null. O mapper ainda está pré-formatando?`,
      ).toBe(true)
    }
  }
}
