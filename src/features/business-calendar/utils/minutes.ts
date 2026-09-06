/**
 * 124/F2 — **minutos desde a meia-noite, `0..1440`** (A-3).
 *
 * ## Por que minuto, e por que 1440 é um valor comum e não uma sentinela
 *
 * `arquitetura.md` A-3: *"`TimeOnly`/`time` **não representa 24:00** (máximo
 * 23:59:59.9999999). Um plano 24/7 precisa de `00:00–24:00`. Sentinela (`fim = 00:00`
 * significa 'fim do dia') é valor cravado governando comportamento — proibido pelas
 * lições desta demanda. `0..1440` expressa o caso naturalmente."*
 *
 * Consequências práticas, todas deliberadas:
 *
 * - **`<input type="time">` está fora de cogitação.** O controle nativo não aceita
 *   `24:00` (o máximo é `23:59`), então usá-lo tornaria o calendário 24/7 —
 *   justamente o caso que motivou A-3 — inexprimível na tela. Os campos são de texto,
 *   com máscara `HH:MM` validada por este módulo.
 * - **`0` e `1440` são horas normais**, cada uma com um significado só: `0` é a
 *   meia-noite que **abre** o dia, `1440` é a que o **fecha**. Nenhum call site pode
 *   ler `0` como "fim do dia" — a fronteira é half-open `[inicio, fim)` e
 *   `fim > inicio` é invariante do banco (`ck_suporte_expedientejanelas_fimminuto`).
 * - A UI mostra **hora** ao usuário; o wire leva **minuto**. A tradução é só aqui.
 */

/** Primeiro minuto válido: a meia-noite que abre o dia. */
export const MINUTO_MINIMO = 0

/**
 * Último minuto válido: a meia-noite que **fecha** o dia (`24:00`).
 * Não é sentinela — é o limite superior da coluna
 * (`ck_suporte_expedientejanelas_fimminuto CHECK ... BETWEEN 0 AND 1440`).
 */
export const MINUTO_MAXIMO = 1440

/** Formato aceito nos campos de hora, exibido ao usuário em `hint`/`placeholder`. */
export const FORMATO_HORA = 'HH:MM'

/**
 * Minuto do dia → `HH:MM`. `1440` vira **`24:00`**, e não `00:00`: as duas
 * meia-noites são pontos diferentes da reta e colapsá-las é a sentinela que A-3 proíbe.
 *
 * Fora de `0..1440` devolve `null` — quem chama decide o que exibir; nunca inventamos
 * uma hora para um valor que o backend não deveria ter mandado.
 */
export function minutoParaHora(minuto: number): string | null {
  if (!Number.isInteger(minuto) || minuto < MINUTO_MINIMO || minuto > MINUTO_MAXIMO) {
    return null
  }
  const horas = Math.floor(minuto / 60)
  const minutos = minuto % 60
  return `${String(horas).padStart(2, '0')}:${String(minutos).padStart(2, '0')}`
}

/**
 * `HH:MM` digitado → minuto do dia, ou `null` quando não é uma hora válida.
 *
 * Aceita, porque é o que um humano digita num campo de texto:
 * `8:00`, `08:00`, `0800`, `800`, `8` (hora cheia) e `24:00`.
 * **Não** aceita `24:01` em diante (não existe), nem minuto `>= 60`, nem hora `> 24`.
 */
export function horaParaMinuto(bruto: string): number | null {
  const texto = bruto.trim().replace(/\s/g, '')
  if (texto.length === 0) return null

  const comSeparador = /^(\d{1,2})[:h.](\d{2})$/.exec(texto)
  const semSeparador = /^(\d{1,2})(\d{2})$/.exec(texto)
  const soHora = /^(\d{1,2})$/.exec(texto)

  let horas: number
  let minutos: number

  if (comSeparador !== null) {
    horas = Number(comSeparador[1])
    minutos = Number(comSeparador[2])
  } else if (semSeparador !== null) {
    horas = Number(semSeparador[1])
    minutos = Number(semSeparador[2])
  } else if (soHora !== null) {
    horas = Number(soHora[1])
    minutos = 0
  } else {
    return null
  }

  if (minutos > 59) return null
  if (horas > 24) return null

  const minuto = horas * 60 + minutos
  // 24:00 é o teto; 24:30 seria 1470 e não existe.
  if (minuto > MINUTO_MAXIMO) return null
  return minuto
}

/** `08:00 às 18:00` — rótulo de leitura de uma janela já validada. */
export function formatarJanela(inicioMinuto: number, fimMinuto: number): string {
  const inicio = minutoParaHora(inicioMinuto)
  const fim = minutoParaHora(fimMinuto)
  if (inicio === null || fim === null) return 'Janela inválida'
  return `${inicio} às ${fim}`
}

/**
 * Duração em texto curto (`4h`, `4h30`, `30min`) a partir de um total de minutos.
 * Usada nos totais da grade — é o número que o usuário confere para saber se o
 * expediente ficou como ele queria.
 */
export function formatarDuracao(totalMinutos: number): string {
  if (!Number.isFinite(totalMinutos) || totalMinutos <= 0) return '0h'
  const horas = Math.floor(totalMinutos / 60)
  const minutos = totalMinutos % 60
  if (horas === 0) return `${minutos}min`
  if (minutos === 0) return `${horas}h`
  return `${horas}h${String(minutos).padStart(2, '0')}`
}
