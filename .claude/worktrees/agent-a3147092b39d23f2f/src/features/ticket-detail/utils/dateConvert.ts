/**
 * Conversão entre ISO UTC e valor de <input type="datetime-local"> (R3).
 *
 * DECISÃO DO MANAGER (R3): a conversão usa a **timezone local do navegador**:
 *   - localInputToIso: `new Date(localValue).toISOString()` — o valor naive do
 *     datetime-local é interpretado no fuso do navegador e convertido para UTC.
 *   - isoToLocalInput: formata o instante UTC no fuso do navegador como
 *     "YYYY-MM-DDTHH:mm" (16 chars) para preencher o input.
 *
 * NÃO instalar date-fns-tz. O round-trip preserva o instante absoluto.
 */

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/**
 * ISO Z → valor de datetime-local ("YYYY-MM-DDTHH:mm") no fuso do navegador.
 * Retorna '' se o ISO for inválido.
 */
export function isoToLocalInput(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  // getFullYear/getMonth/... usam o fuso local do navegador.
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/**
 * Valor de datetime-local (naive, fuso do navegador) → ISO Z (UTC).
 * Retorna '' se o valor for vazio/inválido.
 */
export function localInputToIso(value: string): string {
  if (!value) return ''
  const d = new Date(value) // interpreta no fuso local do navegador
  if (Number.isNaN(d.getTime())) return ''
  return d.toISOString()
}
