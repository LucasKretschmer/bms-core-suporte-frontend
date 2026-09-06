import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../services/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}))

import { api } from '../../../services/api'
import {
  createCalendar,
  createHoliday,
  createSchedule,
  deleteHoliday,
  getHolidayImpact,
  getSchedule,
  importHolidays,
  listCalendars,
  listHolidays,
  updateCalendar,
  updateHoliday,
} from './businessCalendarService'
import type { CalendarDto, HolidayDto, ScheduleDto } from '../types/calendar'

const calendario: CalendarDto = {
  id: 3,
  nome: 'Padrão',
  padrao: true,
  ignorarFeriados: false,
  slaPadraoMinutos: 30,
}

const schedule: ScheduleDto = {
  vigente: {
    id: 9,
    vigenciaInicio: '2026-09-01',
    janelas: [{ diaSemana: 1, inicioMinuto: 480, fimMinuto: 1080 }],
  },
  versoes: [{ id: 9, vigenciaInicio: '2026-09-01', janelasCount: 1 }],
}

const feriado: HolidayDto = { id: 5, data: '2026-12-25', nome: 'Natal' }

describe('businessCalendarService — calendários', () => {
  beforeEach(() => vi.clearAllMocks())

  it('listCalendars chama GET /api/v1/calendars e desempacota { data }', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: { data: [calendario] } })
    expect(await listCalendars()).toEqual([calendario])
    expect(api.get).toHaveBeenCalledWith('/api/v1/calendars')
  })

  it('createCalendar posta o corpo com os tipos do wire', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ data: { data: calendario } })
    await createCalendar({
      nome: '24/7',
      padrao: false,
      ignorarFeriados: true,
      slaPadraoMinutos: 30,
    })
    const [url, corpo] = vi.mocked(api.post).mock.calls[0]
    expect(url).toBe('/api/v1/calendars')
    const noWire = JSON.parse(JSON.stringify(corpo)) as { slaPadraoMinutos: unknown }
    expect(typeof noWire.slaPadraoMinutos).toBe('number')
  })

  it('updateCalendar usa o id NUMÉRICO na rota (R-10)', async () => {
    vi.mocked(api.put).mockResolvedValueOnce({ data: { data: calendario } })
    await updateCalendar(3, {
      nome: 'Padrão',
      padrao: true,
      ignorarFeriados: false,
      slaPadraoMinutos: null,
    })
    expect(vi.mocked(api.put).mock.calls[0][0]).toBe('/api/v1/calendars/3')
  })
})

describe('businessCalendarService — expediente', () => {
  beforeEach(() => vi.clearAllMocks())

  it('getSchedule chama a rota aninhada do calendário', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: { data: schedule } })
    expect(await getSchedule(3)).toEqual(schedule)
    expect(api.get).toHaveBeenCalledWith('/api/v1/calendars/3/schedule')
  })

  it('createSchedule leva dia e minutos como NÚMERO no JSON serializado (R-10)', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ data: { data: schedule } })
    await createSchedule(3, {
      vigenciaInicio: '2026-10-01',
      janelas: [{ diaSemana: 0, inicioMinuto: 0, fimMinuto: 1440 }],
    })

    const [url, corpo] = vi.mocked(api.post).mock.calls[0]
    expect(url).toBe('/api/v1/calendars/3/schedule')
    const noWire = JSON.parse(JSON.stringify(corpo)) as {
      vigenciaInicio: string
      janelas: { diaSemana: unknown; inicioMinuto: unknown; fimMinuto: unknown }[]
    }
    expect(noWire.vigenciaInicio).toBe('2026-10-01')
    expect(typeof noWire.janelas[0].diaSemana).toBe('number')
    expect(typeof noWire.janelas[0].inicioMinuto).toBe('number')
    expect(typeof noWire.janelas[0].fimMinuto).toBe('number')
    // R-6/A-3 no wire: domingo é 0 e o dia inteiro termina em 1440, não em 0.
    expect(noWire.janelas[0]).toEqual({ diaSemana: 0, inicioMinuto: 0, fimMinuto: 1440 })
  })

  it('janelas vazias são enviadas como lista vazia — "expediente desligado" é estado válido', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ data: { data: schedule } })
    await createSchedule(3, { vigenciaInicio: '2026-10-01', janelas: [] })
    const corpo = vi.mocked(api.post).mock.calls[0][1] as { janelas: unknown[] }
    expect(corpo.janelas).toEqual([])
  })
})

describe('businessCalendarService — feriados', () => {
  beforeEach(() => vi.clearAllMocks())

  it('listHolidays envia page e pageSize; SEM filtro, a chave `ano` não vai no wire (R-7)', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      data: { data: { items: [feriado], totalCount: 1, page: 1, pageSize: 25, totalPages: 1 } },
    })

    await listHolidays(3, { ano: null, page: 1, pageSize: 25 })

    const [url, config] = vi.mocked(api.get).mock.calls[0]
    expect(url).toBe('/api/v1/calendars/3/holidays')
    const params = (config as { params: Record<string, unknown> }).params
    expect(params).toEqual({ page: 1, pageSize: 25 })
    // Mandar `ano: null` faria o ASP.NET receber a string "null" e devolver 400.
    expect('ano' in params).toBe(false)
  })

  it('listHolidays envia `ano` como número quando há filtro — companheira positiva', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      data: { data: { items: [], totalCount: 0, page: 2, pageSize: 50, totalPages: 0 } },
    })

    await listHolidays(3, { ano: 2026, page: 2, pageSize: 50 })

    const params = (vi.mocked(api.get).mock.calls[0][1] as { params: Record<string, unknown> })
      .params
    expect(params).toEqual({ ano: 2026, page: 2, pageSize: 50 })
    expect(typeof params.ano).toBe('number')
  })

  it('createHoliday posta { data, nome } na rota aninhada', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ data: { data: feriado } })
    await createHoliday(3, { data: '2026-12-25', nome: 'Natal' })
    expect(vi.mocked(api.post).mock.calls[0][0]).toBe('/api/v1/calendars/3/holidays')
    expect(vi.mocked(api.post).mock.calls[0][1]).toEqual({ data: '2026-12-25', nome: 'Natal' })
  })

  it('updateHoliday usa os DOIS ids numéricos na rota', async () => {
    vi.mocked(api.put).mockResolvedValueOnce({ data: { data: feriado } })
    await updateHoliday(3, 5, { data: '2026-12-25', nome: 'Natal' })
    expect(vi.mocked(api.put).mock.calls[0][0]).toBe('/api/v1/calendars/3/holidays/5')
  })

  it('deleteHoliday devolve o CORPO da resposta (200, não 204) — é onde vem o aviso DD-2', async () => {
    vi.mocked(api.delete).mockResolvedValueOnce({
      data: { data: { ...feriado, avisoRetroativo: true, ticketsFechadosNoDia: 4 } },
    })
    const removido = await deleteHoliday(3, 5)
    expect(vi.mocked(api.delete).mock.calls[0][0]).toBe('/api/v1/calendars/3/holidays/5')
    expect(removido.avisoRetroativo).toBe(true)
    expect(removido.ticketsFechadosNoDia).toBe(4)
  })
})

describe('businessCalendarService — pré-contagem de impacto (DD-2)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('chama GET .../holidays/impacto com a data na query e desempacota { data }', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      data: { data: { data: '2026-03-04', avisoRetroativo: true, ticketsFechadosNoDia: 12 } },
    })

    const impacto = await getHolidayImpact(3, '2026-03-04')

    const [url, config] = vi.mocked(api.get).mock.calls[0]
    expect(url).toBe('/api/v1/calendars/3/holidays/impacto')
    expect((config as { params: Record<string, unknown> }).params).toEqual({ data: '2026-03-04' })
    expect(impacto).toEqual({
      data: '2026-03-04',
      avisoRetroativo: true,
      ticketsFechadosNoDia: 12,
    })
  })

  it('é um GET — a pré-contagem não pode ter efeito colateral', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      data: { data: { data: '2026-09-06', avisoRetroativo: false, ticketsFechadosNoDia: 0 } },
    })

    await getHolidayImpact(3, '2026-09-06')

    expect(api.post).not.toHaveBeenCalled()
    expect(api.put).not.toHaveBeenCalled()
    expect(api.delete).not.toHaveBeenCalled()
  })
})

describe('businessCalendarService — importação (A-8: JSON, nunca arquivo)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('envia { itens } no corpo e dryRun na query', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({
      data: { data: { total: 1, criados: 1, atualizados: 0, inalterados: 0, dryRun: true } },
    })

    await importHolidays(3, [{ data: '2026-12-25', nome: 'Natal' }], true)

    const [url, corpo, config] = vi.mocked(api.post).mock.calls[0]
    expect(url).toBe('/api/v1/calendars/3/holidays/import')
    expect(corpo).toEqual({ itens: [{ data: '2026-12-25', nome: 'Natal' }] })
    expect((config as { params: { dryRun: boolean } }).params).toEqual({ dryRun: true })
  })

  it('o corpo é JSON puro — nenhum FormData, nenhum arquivo', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({
      data: { data: { total: 0, criados: 0, atualizados: 0, inalterados: 0, dryRun: false } },
    })

    await importHolidays(3, [{ data: '2026-12-25', nome: 'Natal' }], false)

    const corpo = vi.mocked(api.post).mock.calls[0][1]
    expect(corpo).not.toBeInstanceOf(FormData)
    expect(JSON.parse(JSON.stringify(corpo))).toEqual({
      itens: [{ data: '2026-12-25', nome: 'Natal' }],
    })
  })
})
