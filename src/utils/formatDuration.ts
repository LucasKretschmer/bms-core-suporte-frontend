/**
 * Formata uma duração em milissegundos para string legível.
 *
 * null → "—"
 * < 1s  → "500ms"
 * < 1min → "2.5s"
 * >= 1min → "1m 30s"
 *
 * Função pura — testável sem render.
 *
 * 129 — o parâmetro aceita `undefined` e o guard é `== null`. O valor vem do wire
 * (`LogDto.duracaoMs`), e o backend OMITE a chave quando ela é nula
 * (`DefaultIgnoreCondition = WhenWritingNull`). Com `ms: number | null` + `ms === null`,
 * um `undefined` atravessava as três comparações numéricas e saía como `NaNm NaNs`.
 */
export function formatDuration(ms: number | null | undefined): string {
  if (ms == null) return '—'
  if (ms < 1_000) return `${ms}ms`
  if (ms < 60_000) return `${(ms / 1_000).toFixed(1)}s`
  const min = Math.floor(ms / 60_000)
  const sec = Math.round((ms % 60_000) / 1_000)
  return `${min}m ${sec}s`
}
