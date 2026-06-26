/**
 * Formata uma duração em milissegundos para string legível.
 *
 * null → "—"
 * < 1s  → "500ms"
 * < 1min → "2.5s"
 * >= 1min → "1m 30s"
 *
 * Função pura — testável sem render.
 */
export function formatDuration(ms: number | null): string {
  if (ms === null) return '—'
  if (ms < 1_000) return `${ms}ms`
  if (ms < 60_000) return `${(ms / 1_000).toFixed(1)}s`
  const min = Math.floor(ms / 60_000)
  const sec = Math.round((ms % 60_000) / 1_000)
  return `${min}m ${sec}s`
}
