/**
 * 124/F2 — **A convenção de dia da semana do sistema, fixada por escrito.**
 *
 * ## R-6: `0 = domingo`, e NUNCA se traduz
 *
 * `arquitetura.md` §6 R-6: *"`ScheduleWindowDto.diaSemana` é `DayOfWeek` do .NET
 * (0=domingo) e o `Date` do JS **também** é 0=domingo — coincidem, mas por acidente.
 * Fixar `0=domingo` **por escrito** no DTO e num teste; nunca traduzir dia da semana."*
 *
 * As três pontas que precisam concordar:
 *
 * | Ponta | Numeração | Âncora |
 * |---|---|---|
 * | Banco | `expedientejanelas.diasemana smallint`, `CHECK BETWEEN 0 AND 6`, comentário `0=domingo..6=sabado` | migration M3 (`arquitetura.md` §5) |
 * | Backend | `ScheduleWindowDto.DiaSemana` = `DayOfWeek` do .NET | `Suporte.Application/DTOs/Config/CalendarDtos.cs` (XML-doc "R-6 — DiaSemana NÃO se traduz") |
 * | Frontend | **este arquivo** | `Date.prototype.getDay()` |
 *
 * O `fe-f1-report.md` §4 registrou explicitamente que a convenção **ainda não estava
 * fixada em lugar nenhum do frontend** (F1 não tem campo de dia da semana). Este módulo é
 * onde ela passa a estar, e `weekday.test.ts` é a trava: ele afirma a identidade da
 * tabela com literais escritos à mão **e** ancora o índice 0 num domingo real do
 * calendário via `getDay()`. Um `+1`, um `% 7` ou uma lista começando na segunda-feira
 * reprovam nas duas asserções.
 *
 * ⚠️ **Nada aqui converte, desloca ou reordena.** A ordem de exibição na tela é a ordem
 * da numeração (domingo primeiro) exatamente para que índice e posição coincidam — pôr
 * "segunda-feira primeiro" na UI criaria um segundo mapa mantido à mão, que é como o
 * off-by-one nasce.
 */

/** Dia da semana no wire: `DayOfWeek` do .NET = `Date.getDay()` do JS. */
export type DiaSemana = 0 | 1 | 2 | 3 | 4 | 5 | 6

/** O índice 0. Existe como constante para que nenhum call site escreva `0` "de memória". */
export const DOMINGO: DiaSemana = 0

/** O índice 6. */
export const SABADO: DiaSemana = 6

export type DiaDaSemana = {
  /** Valor que viaja no wire e é gravado na coluna. */
  valor: DiaSemana
  /** Rótulo exibido ao usuário. */
  nome: string
  /** Rótulo curto para cabeçalho de grade. */
  abreviacao: string
}

/**
 * Os sete dias, **em ordem de valor** — `DIAS_DA_SEMANA[n].valor === n` é invariante
 * (testado). Iterar esta lista é a única forma suportada de percorrer a semana.
 */
export const DIAS_DA_SEMANA: readonly DiaDaSemana[] = [
  { valor: 0, nome: 'Domingo', abreviacao: 'Dom' },
  { valor: 1, nome: 'Segunda-feira', abreviacao: 'Seg' },
  { valor: 2, nome: 'Terça-feira', abreviacao: 'Ter' },
  { valor: 3, nome: 'Quarta-feira', abreviacao: 'Qua' },
  { valor: 4, nome: 'Quinta-feira', abreviacao: 'Qui' },
  { valor: 5, nome: 'Sexta-feira', abreviacao: 'Sex' },
  { valor: 6, nome: 'Sábado', abreviacao: 'Sáb' },
] as const

/** `true` só para 0..6 inteiros — usado na fronteira com o wire, sem `as`. */
export function ehDiaSemana(valor: number): valor is DiaSemana {
  return Number.isInteger(valor) && valor >= 0 && valor <= 6
}

/**
 * Nome do dia a partir do valor do wire. Valor fora de 0..6 devolve um rótulo que
 * **denuncia** o problema em vez de cair no domingo — "não sei responder" nunca vira
 * "respondi que é domingo" (AP-FRONTEND-021).
 */
export function nomeDoDia(valor: number): string {
  if (!ehDiaSemana(valor)) return `Dia ${valor} (fora da convenção 0–6)`
  return DIAS_DA_SEMANA[valor].nome
}

/**
 * Dia da semana de uma data `AAAA-MM-DD` **como dia civil**.
 *
 * `new Date('2026-09-06')` é interpretado pelo JS como **meia-noite UTC** e, em
 * `America/Sao_Paulo` (UTC−3), volta um dia — o feriado de domingo apareceria como
 * sábado. Por isso os componentes são passados ao construtor local, nunca a string.
 *
 * Devolve `null` para texto que não seja uma data civil válida.
 */
export function diaSemanaDaData(iso: string): DiaSemana | null {
  const casamento = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim())
  if (casamento === null) return null

  const ano = Number(casamento[1])
  const mes = Number(casamento[2])
  const dia = Number(casamento[3])

  const data = new Date(ano, mes - 1, dia)
  // Rejeita 2026-02-31: o construtor "rola" para 03/03 em silêncio.
  if (data.getFullYear() !== ano || data.getMonth() !== mes - 1 || data.getDate() !== dia) {
    return null
  }

  const valor = data.getDay()
  return ehDiaSemana(valor) ? valor : null
}
