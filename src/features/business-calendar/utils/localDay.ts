/**
 * 124/F2+F3 — **o dia local de São Paulo, do jeito que o backend o entende.**
 *
 * `arquitetura.md` §4 ponto 5: `feriados.data` e `expedientes.vigenciainicio` são
 * **dia local SP**, obtidos no backend por `FusoSaoPaulo.DiaLocal(instante)` — nunca
 * `DateOnly.FromDateTime(instanteUtc)`, *"isso desloca o dia para tudo a partir das
 * 21:00 SP"*.
 *
 * No navegador o erro simétrico é usar o relógio da máquina: quem estiver com o fuso do
 * sistema em UTC (é o caso do runner de teste em CI) veria "hoje" avançar três horas
 * antes. Como o aviso de retroatividade (DD-2) decide **pelo dia**, um deslocamento de
 * um dia inteiro é a diferença entre pedir confirmação e não pedir.
 *
 * Por isso o dia vem de `Intl.DateTimeFormat` com `timeZone: 'America/Sao_Paulo'` e
 * `formatToParts` (nunca de `toISOString()`, que é UTC, nem de `format()` do date-fns,
 * que é o fuso da máquina). O resto do frontend usa o relógio local e documenta a
 * limitação (`reports/shared/utils/defaultPeriod.ts`); aqui ela não é aceitável.
 */

/** Fuso de operação do sistema — o mesmo de `FusoSaoPaulo.Zona` no backend. */
export const FUSO_SAO_PAULO = 'America/Sao_Paulo'

/** Faixa aceita para data de feriado (§4 ponto 6) — espelha `HolidayService.AnosParaTras`. */
export const ANOS_PARA_TRAS = 10

/** Espelha `HolidayService.AnosParaFrente`. */
export const ANOS_PARA_FRENTE = 10

const formatador = new Intl.DateTimeFormat('en-CA', {
  timeZone: FUSO_SAO_PAULO,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/**
 * O dia civil em São Paulo no instante dado, como `AAAA-MM-DD`.
 * Montado por `formatToParts` — a ordem das partes é lida do resultado, não presumida
 * pelo locale.
 */
export function diaLocalSaoPaulo(referencia: Date = new Date()): string {
  const partes = formatador.formatToParts(referencia)
  const parte = (tipo: Intl.DateTimeFormatPartTypes): string =>
    partes.find((p) => p.type === tipo)?.value ?? ''
  return `${parte('year')}-${parte('month')}-${parte('day')}`
}

/**
 * `true` quando a data (dia civil SP) é **anterior a hoje**.
 *
 * É o predicado do aviso de retroatividade (DD-2): mexer num feriado **passado** muda
 * indicador já apurado, porque feriado não é versionado (AUTO-124-3). Hoje **não** é
 * passado — a comparação é estritamente `<`, igual à do backend
 * (`HolidayService.ComAvisoRetroativoAsync`).
 *
 * Comparação lexicográfica: `AAAA-MM-DD` é ordenável como texto, e assim não há
 * nenhuma conversão para `Date` (nem fuso) no caminho.
 */
export function ehDiaPassado(iso: string, hoje: string = diaLocalSaoPaulo()): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false
  return iso < hoje
}

/** Soma anos a um dia `AAAA-MM-DD` mantendo-o dia civil (sem `Date`, sem fuso). */
export function somarAnos(iso: string, anos: number): string {
  const casamento = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (casamento === null) return iso
  const ano = Number(casamento[1]) + anos
  return `${String(ano).padStart(4, '0')}-${casamento[2]}-${casamento[3]}`
}

/** Faixa `[hoje − 10 anos, hoje + 10 anos]` aceita para datas de feriado. */
export function faixaAceitaDeFeriado(hoje: string = diaLocalSaoPaulo()): {
  minimo: string
  maximo: string
} {
  return { minimo: somarAnos(hoje, -ANOS_PARA_TRAS), maximo: somarAnos(hoje, ANOS_PARA_FRENTE) }
}

const MESES = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
]

/**
 * `2026-04-03` → `3 de abril de 2026`.
 *
 * É a forma exigida pela arquitetura na desambiguação de `03/04` (§4 ponto 6):
 * *"com a interpretação renderizada por extenso ('3 de abril de 2026')"*. Data por
 * extenso é a única redação em que o usuário **vê** que escolheu errado.
 *
 * Escrita à mão a partir dos componentes — `toLocaleDateString` sobre um `Date`
 * reintroduziria a conversão de fuso que este módulo existe para evitar.
 */
export function dataPorExtenso(iso: string): string {
  const casamento = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (casamento === null) return iso
  const mes = Number(casamento[2])
  if (mes < 1 || mes > 12) return iso
  return `${Number(casamento[3])} de ${MESES[mes - 1]} de ${Number(casamento[1])}`
}

/** `2026-04-03` → `03/04/2026`. Puramente textual, sem `Date`. */
export function dataCurta(iso: string): string {
  const casamento = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (casamento === null) return iso
  return `${casamento[3]}/${casamento[2]}/${casamento[1]}`
}
