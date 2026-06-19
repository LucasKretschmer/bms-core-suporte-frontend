import axios from 'axios'
import { describe, expect, it } from 'vitest'
import { handleApiError } from './handleApiError'

describe('handleApiError', () => {
  it('extrai message do envelope error.response.data.error.message', () => {
    const error = new axios.AxiosError(
      'Request failed',
      '422',
      undefined,
      undefined,
      {
        data: { error: { code: 'VALIDATION_ERROR', message: 'E-mail inválido.' } },
        status: 422,
        statusText: 'Unprocessable Entity',
        headers: {},
        config: {} as Parameters<typeof axios.AxiosError>[2],
      } as Parameters<typeof axios.AxiosError>[4],
    )
    expect(handleApiError(error)).toBe('E-mail inválido.')
  })

  it('retorna mensagem específica para 429', () => {
    const error = new axios.AxiosError(
      'Too Many Requests',
      '429',
      undefined,
      undefined,
      {
        data: {},
        status: 429,
        statusText: 'Too Many Requests',
        headers: {},
        config: {} as Parameters<typeof axios.AxiosError>[2],
      } as Parameters<typeof axios.AxiosError>[4],
    )
    expect(handleApiError(error)).toBe('Muitas tentativas. Aguarde antes de tentar novamente.')
  })

  it('retorna mensagem específica para 403', () => {
    const error = new axios.AxiosError(
      'Forbidden',
      '403',
      undefined,
      undefined,
      {
        data: {},
        status: 403,
        statusText: 'Forbidden',
        headers: {},
        config: {} as Parameters<typeof axios.AxiosError>[2],
      } as Parameters<typeof axios.AxiosError>[4],
    )
    expect(handleApiError(error)).toBe('Você não tem permissão para realizar esta ação.')
  })

  it('retorna fallback para erro não-Axios', () => {
    expect(handleApiError(new Error('qualquer coisa'))).toBe('Ocorreu um erro inesperado.')
  })

  it('retorna fallback para string lançada', () => {
    expect(handleApiError('erro qualquer')).toBe('Ocorreu um erro inesperado.')
  })

  it('retorna fallback quando não há message no envelope', () => {
    const error = new axios.AxiosError(
      'Server Error',
      '500',
      undefined,
      undefined,
      {
        data: { error: {} },
        status: 500,
        statusText: 'Internal Server Error',
        headers: {},
        config: {} as Parameters<typeof axios.AxiosError>[2],
      } as Parameters<typeof axios.AxiosError>[4],
    )
    expect(handleApiError(error)).toBe('Ocorreu um erro inesperado.')
  })
})
