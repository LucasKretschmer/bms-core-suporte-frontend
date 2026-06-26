/**
 * Persistência de filtros de telas de relatório em sessionStorage.
 *
 * Usado para preservar os filtros da tela de origem ao fazer drill-down (R2):
 * antes de navegar, a tela de origem salva seus filtros; ao voltar (via breadcrumb),
 * reidrata. Search params têm prioridade sobre estes valores.
 *
 * Falhas (storage indisponível, JSON inválido) são silenciosas — preferência de
 * filtro não é crítica. Genérico <T> — nunca `any`.
 */

const KEY_PREFIX = 'report-filters:'

/** Salva os filtros da tela sob a chave informada. Falha silenciosa. */
export function saveReportFilters<T>(key: string, filters: T): void {
  try {
    sessionStorage.setItem(`${KEY_PREFIX}${key}`, JSON.stringify(filters))
  } catch {
    // Storage indisponível ou cota excedida — preferência não é crítica.
  }
}

/**
 * Carrega os filtros da tela. Retorna o `fallback` se a chave não existir
 * ou o conteúdo for inválido.
 */
export function loadReportFilters<T>(key: string, fallback: T): T {
  try {
    const raw = sessionStorage.getItem(`${KEY_PREFIX}${key}`)
    if (!raw) return fallback
    const parsed = JSON.parse(raw) as unknown
    if (parsed === null || typeof parsed !== 'object') return fallback
    // Mescla sobre o fallback para tolerar formatos parciais/antigos.
    return { ...fallback, ...(parsed as Partial<T>) }
  } catch {
    return fallback
  }
}

/** Remove os filtros persistidos de uma tela. */
export function clearReportFilters(key: string): void {
  try {
    sessionStorage.removeItem(`${KEY_PREFIX}${key}`)
  } catch {
    // Falha silenciosa.
  }
}
