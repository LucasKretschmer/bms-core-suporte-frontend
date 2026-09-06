import type { ScheduleWindowDto } from '../types/calendar'
import { horaParaMinuto, minutoParaHora, MINUTO_MAXIMO } from './minutes'
import { DIAS_DA_SEMANA, ehDiaSemana, nomeDoDia, type DiaSemana } from './weekday'

/**
 * 124/F2 — o modelo editável da grade semanal e as suas invariantes.
 *
 * ## A-4: **lista** de janelas por dia, nunca um par (início, fim)
 *
 * *"Intervalo de almoço e sábado meio-período são o caso normal em operação de suporte
 * no Brasil"* (`arquitetura.md` A-4). Por isso o estado da grade é uma lista plana de
 * janelas, cada uma com o seu dia — acrescentar a segunda janela de um dia é a operação
 * barata, e não uma migração de modelo.
 *
 * ## DD-5: janela que cruza a meia-noite **não existe**
 *
 * `fimminuto > iniciominuto` é `CHECK` do banco. A UI recusa **antes** do request, com a
 * mensagem que diz o que fazer: turno noturno são **duas** janelas, em dias
 * consecutivos. Recusar aqui não substitui a guarda do servidor — ela continua sendo a
 * fonte de verdade —, mas evita um `422` que o usuário não teria como interpretar.
 *
 * ## Sobreposição: half-open `[inicio, fim)`
 *
 * `08:00–12:00` e `12:00–18:00` **não** se sobrepõem (a fronteira é a mesma do backend,
 * `CalendarService.ExigirJanelas`). Só `proximo.inicio < anterior.fim` é sobreposição.
 */

/** Uma janela como o usuário a está editando: horas em **texto**, ainda não validadas. */
export type JanelaEditavel = {
  /** Identidade estável da linha no editor (React `key` e alvo dos erros). */
  id: string
  diaSemana: DiaSemana
  /** Texto digitado, `HH:MM`. */
  inicio: string
  /** Texto digitado, `HH:MM`. */
  fim: string
}

/** Erro de uma janela específica, ligado ao campo que o usuário precisa corrigir. */
export type ErroDeJanela = {
  janelaId: string
  campo: 'inicio' | 'fim'
  mensagem: string
}

export type ValidacaoDaGrade = {
  erros: ErroDeJanela[]
  /** Janelas prontas para o wire — só preenchido quando `erros` está vazio. */
  janelas: ScheduleWindowDto[]
}

/**
 * Mensagem de DD-5. **Idêntica em espírito à do backend**
 * (`CalendarService.ExigirJanelas`): diz o que fazer, não só o que está errado.
 */
export const MENSAGEM_FIM_ANTES_DO_INICIO =
  'O fim deve ser maior que o início. Um turno que atravessa a meia-noite se cadastra ' +
  'como duas janelas, em dias consecutivos.'

export const MENSAGEM_HORA_INVALIDA = `Informe a hora no formato HH:MM, entre 00:00 e 24:00.`

let contador = 0

/** Id local de linha — `crypto.randomUUID` não está garantido em todo alvo/jsdom. */
export function novoIdDeJanela(): string {
  contador += 1
  return `janela-${contador}`
}

/** Cria uma janela vazia para um dia — o editor decide os horários iniciais. */
export function janelaVazia(diaSemana: DiaSemana, inicio = '', fim = ''): JanelaEditavel {
  return { id: novoIdDeJanela(), diaSemana, inicio, fim }
}

/**
 * Wire → editor. Janelas com `diaSemana` fora de `0..6` são **descartadas**, nunca
 * atribuídas ao domingo: cair no índice 0 é exatamente o off-by-one que R-6 existe para
 * impedir, e ele seria invisível na tela.
 */
export function paraEditaveis(janelas: readonly ScheduleWindowDto[]): JanelaEditavel[] {
  const editaveis: JanelaEditavel[] = []
  for (const janela of janelas) {
    if (!ehDiaSemana(janela.diaSemana)) continue
    const inicio = minutoParaHora(janela.inicioMinuto)
    const fim = minutoParaHora(janela.fimMinuto)
    if (inicio === null || fim === null) continue
    editaveis.push({ id: novoIdDeJanela(), diaSemana: janela.diaSemana, inicio, fim })
  }
  return ordenar(editaveis)
}

/**
 * Ordena por dia e depois por hora de início — a ordem em que a grade é lida.
 *
 * Janela ainda **em branco** (ou com hora inválida) vai para o **fim do dia**, não para o
 * começo: ela é a linha que o usuário acabou de acrescentar, e jogá-la para cima
 * renumeraria as janelas já preenchidas debaixo do cursor dele.
 */
export function ordenar(janelas: readonly JanelaEditavel[]): JanelaEditavel[] {
  const inicioOuFim = (janela: JanelaEditavel): number =>
    horaParaMinuto(janela.inicio) ?? Number.MAX_SAFE_INTEGER
  return [...janelas].sort((a, b) => {
    if (a.diaSemana !== b.diaSemana) return a.diaSemana - b.diaSemana
    return inicioOuFim(a) - inicioOuFim(b)
  })
}

/** As janelas de um dia, na ordem em que aparecem na grade. */
export function janelasDoDia(
  janelas: readonly JanelaEditavel[],
  dia: DiaSemana,
): JanelaEditavel[] {
  return janelas.filter((j) => j.diaSemana === dia)
}

/**
 * Valida a grade inteira e devolve as janelas normalizadas para o wire.
 *
 * **Grade vazia é válida** — é "expediente desligado a partir desta data", estado
 * previsto no contrato (`CreateScheduleDto.Janelas`: *"Lista vazia = expediente
 * desligado"*).
 */
export function validarGrade(janelas: readonly JanelaEditavel[]): ValidacaoDaGrade {
  const erros: ErroDeJanela[] = []
  const convertidas: { janela: JanelaEditavel; inicio: number; fim: number }[] = []

  for (const janela of janelas) {
    const inicio = horaParaMinuto(janela.inicio)
    const fim = horaParaMinuto(janela.fim)

    if (inicio === null) {
      erros.push({ janelaId: janela.id, campo: 'inicio', mensagem: MENSAGEM_HORA_INVALIDA })
    }
    if (fim === null) {
      erros.push({ janelaId: janela.id, campo: 'fim', mensagem: MENSAGEM_HORA_INVALIDA })
    }
    if (inicio === null || fim === null) continue

    if (inicio > MINUTO_MAXIMO || fim > MINUTO_MAXIMO) {
      erros.push({ janelaId: janela.id, campo: 'fim', mensagem: MENSAGEM_HORA_INVALIDA })
      continue
    }

    if (fim <= inicio) {
      erros.push({ janelaId: janela.id, campo: 'fim', mensagem: MENSAGEM_FIM_ANTES_DO_INICIO })
      continue
    }

    convertidas.push({ janela, inicio, fim })
  }

  if (erros.length === 0) {
    for (const dia of DIAS_DA_SEMANA) {
      const doDia = convertidas
        .filter((c) => c.janela.diaSemana === dia.valor)
        .sort((a, b) => a.inicio - b.inicio)

      for (let i = 1; i < doDia.length; i += 1) {
        // Half-open: 12:00 começando onde a anterior termina NÃO é sobreposição.
        if (doDia[i].inicio < doDia[i - 1].fim) {
          erros.push({
            janelaId: doDia[i].janela.id,
            campo: 'inicio',
            mensagem: `Esta janela se sobrepõe a outra de ${nomeDoDia(dia.valor)}. Ajuste os horários para que não se cruzem.`,
          })
        }
      }
    }
  }

  if (erros.length > 0) return { erros, janelas: [] }

  return {
    erros,
    janelas: convertidas
      .sort((a, b) =>
        a.janela.diaSemana === b.janela.diaSemana
          ? a.inicio - b.inicio
          : a.janela.diaSemana - b.janela.diaSemana,
      )
      .map((c) => ({
        diaSemana: c.janela.diaSemana,
        // R-10: número no wire, sempre. O DOM entregou texto.
        inicioMinuto: c.inicio,
        fimMinuto: c.fim,
      })),
  }
}

/** Total de minutos de expediente de um dia — só conta janelas válidas. */
export function minutosDoDia(janelas: readonly JanelaEditavel[], dia: DiaSemana): number {
  return janelasDoDia(janelas, dia).reduce((total, janela) => {
    const inicio = horaParaMinuto(janela.inicio)
    const fim = horaParaMinuto(janela.fim)
    if (inicio === null || fim === null || fim <= inicio) return total
    return total + (fim - inicio)
  }, 0)
}

/** Total de minutos da semana inteira — o número que o usuário confere ao salvar. */
export function minutosDaSemana(janelas: readonly JanelaEditavel[]): number {
  return DIAS_DA_SEMANA.reduce((total, dia) => total + minutosDoDia(janelas, dia.valor), 0)
}

/**
 * Traduz o `field` de um `details[]` de `422 SCHEDULE_WINDOW_OVERLAP` para um rótulo que
 * o usuário reconhece na grade.
 *
 * O backend numera as janelas **na ordem em que as recebeu**
 * (`CalendarService.ExigirJanelas` → `janelas[3].fimMinuto`) e, na sobreposição, usa a
 * forma `janelas[dia 3]`. Sem esta tradução o relatório do servidor seria um índice sem
 * significado na tela — o "toast genérico" que o enunciado proíbe, só que em lista.
 */
export function rotuloDoCampoDeJanela(
  field: string,
  janelasEnviadas: readonly ScheduleWindowDto[],
): string {
  const porIndice = /^janelas\[(\d+)\]\.(\w+)$/.exec(field)
  if (porIndice !== null) {
    const janela = janelasEnviadas[Number(porIndice[1])]
    const campo = porIndice[2] === 'inicioMinuto' ? 'início' : porIndice[2] === 'fimMinuto' ? 'fim' : porIndice[2]
    if (janela === undefined) return `Janela ${Number(porIndice[1]) + 1} (${campo})`
    const horario = minutoParaHora(janela.inicioMinuto) ?? '?'
    const fim = minutoParaHora(janela.fimMinuto) ?? '?'
    return `${nomeDoDia(janela.diaSemana)}, ${horario}–${fim} (${campo})`
  }

  const porDia = /^janelas\[dia (\d+)\]$/.exec(field)
  if (porDia !== null) return nomeDoDia(Number(porDia[1]))

  if (field === 'vigenciaInicio') return 'Início de vigência'

  return field
}
