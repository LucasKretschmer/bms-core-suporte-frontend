import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios'
import { describe, expect, it } from 'vitest'
import {
  CALENDAR_ERROR_CODES,
  errosDeImportacao,
  getCalendarErrorCode,
  getCalendarErrorDetails,
  getCalendarErrorMessage,
} from './calendarErrorMessage'

/** Erro com o envelope real do backend: `{ error: { code, message, details[] } }`. */
function erroApi(
  status: number,
  code: string | null,
  message: string | null,
  details?: unknown,
): AxiosError {
  const config = { headers: new AxiosHeaders() }
  const error: Record<string, unknown> = {}
  if (code != null) error.code = code
  if (message != null) error.message = message
  if (details !== undefined) error.details = details
  const response: AxiosResponse = {
    data: { error },
    status,
    statusText: '',
    headers: {},
    config,
  }
  return new AxiosError(`Request failed with status code ${status}`, undefined, config, {}, response)
}

describe('getCalendarErrorCode', () => {
  it('extrai o código do envelope', () => {
    expect(getCalendarErrorCode(erroApi(409, 'CALENDAR_LAST_DEFAULT', 'x'))).toBe(
      'CALENDAR_LAST_DEFAULT',
    )
  })

  it('devolve null sem envelope e para erro que não é do Axios', () => {
    expect(getCalendarErrorCode(erroApi(500, null, null))).toBeNull()
    expect(getCalendarErrorCode(new Error('boom'))).toBeNull()
  })
})

describe('getCalendarErrorMessage — reconhecimento por CÓDIGO', () => {
  it('preserva a mensagem do servidor e anexa a ação', () => {
    const mensagem = getCalendarErrorMessage(
      erroApi(409, CALENDAR_ERROR_CODES.LAST_DEFAULT, 'Este é o último calendário padrão.'),
    )
    expect(mensagem).toContain('Este é o último calendário padrão.')
    expect(mensagem).toContain('Marque outro calendário como padrão')
  })

  it('não duplica a ação quando o servidor já a escreveu', () => {
    const doServidor =
      'Este é o último calendário padrão. Marque outro calendário como padrão antes de mudar este.'
    expect(
      getCalendarErrorMessage(erroApi(409, CALENDAR_ERROR_CODES.LAST_DEFAULT, doServidor)),
    ).toBe(doServidor)
  })

  it('reconhece pelo código, NÃO pelo texto — mensagem reescrita continua tratada', () => {
    // O que faz este assert ficar vermelho: trocar o `switch`/mapa por comparação de texto.
    const mensagem = getCalendarErrorMessage(
      erroApi(409, CALENDAR_ERROR_CODES.LAST_DEFAULT, 'Redação completamente diferente.'),
    )
    expect(mensagem).toContain('Marque outro calendário como padrão')
  })

  it('código desconhecido cai no handleApiError, preservando a mensagem do envelope', () => {
    expect(getCalendarErrorMessage(erroApi(500, 'ALGO_NOVO', 'Falhou aqui.'))).toBe('Falhou aqui.')
  })
})

describe('getCalendarErrorDetails', () => {
  it('lê os detalhes bem formados e descarta os malformados', () => {
    const detalhes = getCalendarErrorDetails(
      erroApi(422, CALENDAR_ERROR_CODES.WINDOW_OVERLAP, 'x', [
        { field: 'janelas[0].fimMinuto', message: 'O fim deve ser maior que o início.' },
        { field: 42, message: 'sem field string' },
        'texto solto',
      ]),
    )
    expect(detalhes).toEqual([
      { field: 'janelas[0].fimMinuto', message: 'O fim deve ser maior que o início.' },
    ])
  })

  it('sem details devolve lista vazia, nunca undefined', () => {
    expect(getCalendarErrorDetails(erroApi(422, 'X', 'y'))).toEqual([])
  })
})

describe('errosDeImportacao — o 422 chega LINHA A LINHA (AUTO-124-9)', () => {
  it('traduz itens[N].campo em índice + campo + mensagem', () => {
    const { porItem, outros } = errosDeImportacao(
      erroApi(422, CALENDAR_ERROR_CODES.IMPORT_INVALID_ROWS, 'Recusada por inteiro.', [
        { field: 'itens[3].data', message: 'Data deve estar no formato AAAA-MM-DD.' },
        { field: 'itens[7].nome', message: 'O nome do feriado é obrigatório.' },
      ]),
    )

    expect(porItem).toEqual([
      { indice: 3, campo: 'data', mensagem: 'Data deve estar no formato AAAA-MM-DD.' },
      { indice: 7, campo: 'nome', mensagem: 'O nome do feriado é obrigatório.' },
    ])
    expect(outros).toEqual([])
  })

  it('detalhe fora do padrão NÃO some da tela — vai para `outros`', () => {
    const { porItem, outros } = errosDeImportacao(
      erroApi(422, CALENDAR_ERROR_CODES.IMPORT_INVALID_ROWS, 'x', [
        { field: 'itens', message: 'Lista vazia.' },
      ]),
    )
    expect(porItem).toEqual([])
    expect(outros).toEqual([{ field: 'itens', message: 'Lista vazia.' }])
  })

  it('erro sem details devolve as duas listas vazias', () => {
    const { porItem, outros } = errosDeImportacao(new Error('rede'))
    expect(porItem).toEqual([])
    expect(outros).toEqual([])
  })
})
