import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  calendarFormSchema,
  holidayFormSchema,
  parseMinutosInput,
  toCalendarFormValues,
  toCalendarRequest,
  toHolidayRequest,
  type CalendarDto,
  type CalendarRequest,
} from './calendar'

describe('parseMinutosInput', () => {
  it('lê inteiro, recusa vazio, texto e decimal', () => {
    expect(parseMinutosInput('30')).toBe(30)
    expect(parseMinutosInput(' 45 ')).toBe(45)
    expect(parseMinutosInput('')).toBeNull()
    expect(parseMinutosInput('trinta')).toBeNull()
    expect(parseMinutosInput('1,5')).toBeNull()
    expect(parseMinutosInput('0x10')).toBeNull()
  })
})

describe('calendarFormSchema', () => {
  const base = { nome: 'Padrão', padrao: true, ignorarFeriados: false, slaPadraoMinutos: '30' }

  it('aceita o caso normal', () => {
    expect(calendarFormSchema.safeParse(base).success).toBe(true)
  })

  it('meta em branco é válida — "sem meta" é um estado, não um erro', () => {
    expect(calendarFormSchema.safeParse({ ...base, slaPadraoMinutos: '' }).success).toBe(true)
  })

  it('recusa nome vazio, nome > 120 e meta não positiva', () => {
    expect(calendarFormSchema.safeParse({ ...base, nome: '  ' }).success).toBe(false)
    expect(calendarFormSchema.safeParse({ ...base, nome: 'x'.repeat(121) }).success).toBe(false)
    expect(calendarFormSchema.safeParse({ ...base, slaPadraoMinutos: '0' }).success).toBe(false)
    expect(calendarFormSchema.safeParse({ ...base, slaPadraoMinutos: 'trinta' }).success).toBe(
      false,
    )
  })
})

describe('toCalendarFormValues / toCalendarRequest', () => {
  const calendario: CalendarDto = {
    id: 3,
    nome: '24/7',
    padrao: false,
    ignorarFeriados: true,
    slaPadraoMinutos: 30,
  }

  it('campo nulo vira string vazia — nunca "null" renderizado no input', () => {
    expect(toCalendarFormValues({ ...calendario, slaPadraoMinutos: null })).toEqual({
      nome: '24/7',
      padrao: false,
      ignorarFeriados: true,
      slaPadraoMinutos: '',
    })
  })

  it('novo calendário nasce com os defaults do formulário', () => {
    expect(toCalendarFormValues(null)).toEqual({
      nome: '',
      padrao: false,
      ignorarFeriados: false,
      slaPadraoMinutos: '',
    })
  })

  it('R-10 — a meta viaja como NÚMERO no JSON, nunca como string', () => {
    const payload = toCalendarRequest({
      nome: ' 24/7 ',
      padrao: true,
      ignorarFeriados: true,
      slaPadraoMinutos: '30',
    })
    const noWire = JSON.parse(JSON.stringify(payload)) as CalendarRequest
    expect(typeof noWire.slaPadraoMinutos).toBe('number')
    expect(noWire).toEqual({
      nome: '24/7',
      padrao: true,
      ignorarFeriados: true,
      slaPadraoMinutos: 30,
    })
  })

  it('meta em branco vai como null — nunca "" nem 0', () => {
    const noWire = JSON.parse(
      JSON.stringify(
        toCalendarRequest({
          nome: 'Padrão',
          padrao: false,
          ignorarFeriados: false,
          slaPadraoMinutos: '',
        }),
      ),
    ) as CalendarRequest
    expect(noWire.slaPadraoMinutos).toBeNull()
  })
})

describe('holidayFormSchema — a faixa é a MESMA do backend', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-06T15:00:00Z'))
  })
  afterEach(() => vi.useRealTimers())

  it('aceita data ISO dentro de ±10 anos', () => {
    expect(holidayFormSchema.safeParse({ data: '2026-12-25', nome: 'Natal' }).success).toBe(true)
    expect(holidayFormSchema.safeParse({ data: '2016-09-06', nome: 'Limite' }).success).toBe(true)
    expect(holidayFormSchema.safeParse({ data: '2036-09-06', nome: 'Limite' }).success).toBe(true)
  })

  it('recusa fora da faixa, formato errado e nome vazio', () => {
    expect(holidayFormSchema.safeParse({ data: '1900-01-01', nome: 'x' }).success).toBe(false)
    expect(holidayFormSchema.safeParse({ data: '25/12/2026', nome: 'x' }).success).toBe(false)
    expect(holidayFormSchema.safeParse({ data: '2026-12-25', nome: '  ' }).success).toBe(false)
    expect(
      holidayFormSchema.safeParse({ data: '2026-12-25', nome: 'x'.repeat(121) }).success,
    ).toBe(false)
  })

  it('toHolidayRequest apara os espaços e mantém a data ISO do wire', () => {
    expect(toHolidayRequest({ data: ' 2026-12-25 ', nome: ' Natal ' })).toEqual({
      data: '2026-12-25',
      nome: 'Natal',
    })
  })
})
