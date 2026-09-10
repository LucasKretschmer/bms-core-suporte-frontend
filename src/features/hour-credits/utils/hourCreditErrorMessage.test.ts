import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios'
import { describe, expect, it } from 'vitest'
import {
  CODIGOS_DE_ERRO_DE_CREDITO,
  CREDITO_ESTORNADO_ACAO,
  getHourCreditErrorMessage,
} from './hourCreditErrorMessage'

/** Erro com o envelope real do backend (`{ error: { code, message } }`, camelCase). */
function erro(status: number, code: string | undefined, message?: string): AxiosError {
  const config = { headers: new AxiosHeaders() }
  const response: AxiosResponse = {
    data: { error: { code, message } },
    status,
    statusText: '',
    headers: {},
    config,
  }
  return new AxiosError(`Request failed with status code ${status}`, undefined, config, {}, response)
}

describe('getHourCreditErrorMessage', () => {
  it('a identidade do vocabulário de códigos tratados é esta', () => {
    // Código novo no servidor sem tratamento aqui reprova, nomeando a diferença.
    expect([...CODIGOS_DE_ERRO_DE_CREDITO]).toEqual(['CREDITO_ESTORNADO'])
  })

  it('🔴 409 CREDITO_ESTORNADO preserva a mensagem do servidor E acrescenta a ação', () => {
    const texto = getHourCreditErrorMessage(
      erro(409, 'CREDITO_ESTORNADO', 'Crédito 10 já foi estornado em 01/09/2026.'),
    )
    // A mensagem do servidor é a que diz O QUE aconteceu (com o número e a data);
    // trocá-la por texto fixo apagaria a única informação acionável.
    expect(texto).toContain('Crédito 10 já foi estornado em 01/09/2026.')
    expect(texto).toContain(CREDITO_ESTORNADO_ACAO)
  })

  it('ramifica por CÓDIGO, não por status: outro 409 cai no genérico', () => {
    // Casar por status colapsaria conflitos diferentes numa ação só; casar por texto
    // quebraria no dia em que a redação do servidor mudasse.
    const texto = getHourCreditErrorMessage(erro(409, 'OUTRA_COISA', 'Conflito qualquer.'))
    expect(texto).toBe('Conflito qualquer.')
    expect(texto).not.toContain(CREDITO_ESTORNADO_ACAO)
  })

  it('409 sem mensagem no envelope usa só a ação — nunca string vazia', () => {
    expect(getHourCreditErrorMessage(erro(409, 'CREDITO_ESTORNADO', undefined))).toBe(
      CREDITO_ESTORNADO_ACAO,
    )
  })

  it('não duplica a ação quando o servidor já a incluiu', () => {
    const texto = getHourCreditErrorMessage(
      erro(409, 'CREDITO_ESTORNADO', `Falhou. ${CREDITO_ESTORNADO_ACAO}`),
    )
    expect(texto.split('lance um novo crédito').length - 1).toBe(1)
  })

  it('erro sem envelope cai no handleApiError, sem vazar detalhe técnico', () => {
    expect(getHourCreditErrorMessage(new Error('boom'))).toBe('Ocorreu um erro inesperado.')
  })
})
