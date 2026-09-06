import { describe, expect, it } from 'vitest'
import type { ScheduleWindowDto } from '../types/calendar'
import {
  MENSAGEM_FIM_ANTES_DO_INICIO,
  janelaVazia,
  janelasDoDia,
  minutosDaSemana,
  minutosDoDia,
  paraEditaveis,
  rotuloDoCampoDeJanela,
  validarGrade,
  type JanelaEditavel,
} from './schedule'

function janela(diaSemana: 0 | 1 | 2 | 3 | 4 | 5 | 6, inicio: string, fim: string): JanelaEditavel {
  return { ...janelaVazia(diaSemana), inicio, fim }
}

describe('schedule — validação da grade', () => {
  it('grade vazia é VÁLIDA: é "expediente desligado a partir desta data"', () => {
    const resultado = validarGrade([])
    expect(resultado.erros).toEqual([])
    expect(resultado.janelas).toEqual([])
  })

  it('A-4 — vários intervalos no mesmo dia (almoço) passam', () => {
    const resultado = validarGrade([janela(1, '08:00', '12:00'), janela(1, '13:00', '18:00')])
    expect(resultado.erros).toEqual([])
    expect(resultado.janelas).toEqual([
      { diaSemana: 1, inicioMinuto: 480, fimMinuto: 720 },
      { diaSemana: 1, inicioMinuto: 780, fimMinuto: 1080 },
    ])
  })

  it('DD-5 — fim <= início é RECUSADO, com a mensagem que ensina o turno noturno', () => {
    const resultado = validarGrade([janela(2, '22:00', '02:00')])
    expect(resultado.janelas).toEqual([])
    expect(resultado.erros).toHaveLength(1)
    expect(resultado.erros[0].campo).toBe('fim')
    expect(resultado.erros[0].mensagem).toBe(MENSAGEM_FIM_ANTES_DO_INICIO)
    expect(resultado.erros[0].mensagem).toContain('duas janelas')
    expect(resultado.erros[0].mensagem).toContain('dias consecutivos')
  })

  it('DD-5 — início igual ao fim também é recusado (janela de duração zero)', () => {
    expect(validarGrade([janela(3, '09:00', '09:00')]).erros).toHaveLength(1)
  })

  it('24/7 — 00:00 às 24:00 é uma janela válida de 1440 minutos', () => {
    const resultado = validarGrade([janela(0, '00:00', '24:00')])
    expect(resultado.erros).toEqual([])
    expect(resultado.janelas).toEqual([{ diaSemana: 0, inicioMinuto: 0, fimMinuto: 1440 }])
  })

  it('sobreposição no mesmo dia é recusada; fronteira half-open NÃO é sobreposição', () => {
    const sobrepostas = validarGrade([janela(4, '08:00', '13:00'), janela(4, '12:00', '18:00')])
    expect(sobrepostas.erros).toHaveLength(1)
    expect(sobrepostas.erros[0].mensagem).toContain('sobrepõe')
    expect(sobrepostas.erros[0].mensagem).toContain('Quinta-feira')

    const encostadas = validarGrade([janela(4, '08:00', '12:00'), janela(4, '12:00', '18:00')])
    expect(encostadas.erros).toEqual([])
  })

  it('janelas em dias DIFERENTES no mesmo horário não se sobrepõem', () => {
    const resultado = validarGrade([janela(1, '08:00', '18:00'), janela(2, '08:00', '18:00')])
    expect(resultado.erros).toEqual([])
    expect(resultado.janelas).toHaveLength(2)
  })

  it('hora inválida é recusada campo a campo', () => {
    const resultado = validarGrade([janela(5, 'oito', '18:00'), janela(5, '08:00', '25:00')])
    expect(resultado.erros.map((e) => e.campo)).toEqual(['inicio', 'fim'])
  })

  it('R-10 — o wire leva NÚMERO, nunca a string digitada', () => {
    const resultado = validarGrade([janela(6, '08:00', '12:00')])
    const noWire = JSON.parse(JSON.stringify(resultado.janelas)) as ScheduleWindowDto[]
    expect(typeof noWire[0].diaSemana).toBe('number')
    expect(typeof noWire[0].inicioMinuto).toBe('number')
    expect(typeof noWire[0].fimMinuto).toBe('number')
    expect(noWire[0]).toEqual({ diaSemana: 6, inicioMinuto: 480, fimMinuto: 720 })
  })

  it('R-6 — o dia da semana NÃO é traduzido: domingo sai 0, sábado sai 6', () => {
    const resultado = validarGrade([janela(0, '09:00', '13:00'), janela(6, '09:00', '13:00')])
    expect(resultado.janelas.map((j) => j.diaSemana)).toEqual([0, 6])
  })

  it('as janelas saem ordenadas por dia e hora, como o backend as numera', () => {
    const resultado = validarGrade([
      janela(3, '14:00', '18:00'),
      janela(1, '08:00', '12:00'),
      janela(3, '08:00', '12:00'),
    ])
    expect(resultado.janelas.map((j) => [j.diaSemana, j.inicioMinuto])).toEqual([
      [1, 480],
      [3, 480],
      [3, 840],
    ])
  })
})

describe('schedule — wire para editor', () => {
  it('converte minuto em HH:MM e ordena', () => {
    const editaveis = paraEditaveis([
      { diaSemana: 2, inicioMinuto: 480, fimMinuto: 720 },
      { diaSemana: 0, inicioMinuto: 0, fimMinuto: 1440 },
    ])
    expect(editaveis.map((j) => [j.diaSemana, j.inicio, j.fim])).toEqual([
      [0, '00:00', '24:00'],
      [2, '08:00', '12:00'],
    ])
  })

  it('janela com dia fora de 0..6 é DESCARTADA, nunca atribuída ao domingo', () => {
    const editaveis = paraEditaveis([
      { diaSemana: 7 as unknown as 0, inicioMinuto: 480, fimMinuto: 720 },
      { diaSemana: 0, inicioMinuto: 60, fimMinuto: 120 },
    ])
    expect(editaveis).toHaveLength(1)
    expect(janelasDoDia(editaveis, 0)).toEqual([
      expect.objectContaining({ inicio: '01:00', fim: '02:00' }),
    ])
  })
})

describe('schedule — totais', () => {
  it('soma só as janelas válidas do dia e da semana', () => {
    const grade = [
      janela(1, '08:00', '12:00'),
      janela(1, '13:00', '18:00'),
      janela(6, '08:00', '12:00'),
      janela(2, '18:00', '08:00'), // inválida: não entra em nenhum total
    ]
    expect(minutosDoDia(grade, 1)).toBe(540)
    expect(minutosDoDia(grade, 6)).toBe(240)
    expect(minutosDoDia(grade, 2)).toBe(0)
    expect(minutosDaSemana(grade)).toBe(780)
  })
})

describe('schedule — rótulo do details[] do 422', () => {
  const enviadas: ScheduleWindowDto[] = [
    { diaSemana: 1, inicioMinuto: 480, fimMinuto: 720 },
    { diaSemana: 6, inicioMinuto: 480, fimMinuto: 720 },
  ]

  it('traduz janelas[N].campo para dia + horário', () => {
    expect(rotuloDoCampoDeJanela('janelas[1].fimMinuto', enviadas)).toBe(
      'Sábado, 08:00–12:00 (fim)',
    )
    expect(rotuloDoCampoDeJanela('janelas[0].inicioMinuto', enviadas)).toBe(
      'Segunda-feira, 08:00–12:00 (início)',
    )
  })

  it('traduz janelas[dia N] pela MESMA convenção 0 = domingo', () => {
    expect(rotuloDoCampoDeJanela('janelas[dia 0]', enviadas)).toBe('Domingo')
    expect(rotuloDoCampoDeJanela('janelas[dia 6]', enviadas)).toBe('Sábado')
  })

  it('campo desconhecido não some da tela — volta como veio', () => {
    expect(rotuloDoCampoDeJanela('vigenciaInicio', enviadas)).toBe('Início de vigência')
    expect(rotuloDoCampoDeJanela('campoNovoDoBackend', enviadas)).toBe('campoNovoDoBackend')
  })
})
