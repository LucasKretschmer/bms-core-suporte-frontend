import { AxiosError, AxiosHeaders } from 'axios'
import { describe, expect, it } from 'vitest'
import {
  codigoDoErro,
  getBillingPeriodErrorMessage,
  mensagemDoServidor,
} from './billingPeriodErrorMessage'

/** Erro do axios com o envelope real do backend: `{ error: { code, message } }`. */
function erroDaApi(status: number, code?: string, message?: string): AxiosError {
  const headers = new AxiosHeaders()
  const config = { headers }
  return new AxiosError('Request failed', String(status), config, null, {
    status,
    statusText: '',
    headers,
    config,
    data: code === undefined && message === undefined ? {} : { error: { code, message } },
  })
}

describe('getBillingPeriodErrorMessage', () => {
  it('409 COMPETENCIA_COM_CREDITOS_DEPENDENTES PRESERVA a mensagem do servidor', () => {
    // 🔴 É a mensagem do servidor que traz a CONTAGEM ("3 créditos vivos…"). Substituí-la
    // por texto fixo apagaria o único número que existe sobre o impacto.
    const mensagem = getBillingPeriodErrorMessage(
      erroDaApi(
        409,
        'COMPETENCIA_COM_CREDITOS_DEPENDENTES',
        '3 créditos vivos dependem desta competência.',
      ),
    )

    expect(mensagem).toContain('3 créditos vivos dependem desta competência.')
    expect(mensagem).toContain('Marque a confirmação de impacto')
    // C-8: a mensagem não pode sugerir que algo será corrigido.
    expect(mensagem).toContain('permanecem exatamente como estão')
  })

  it('ramifica por CÓDIGO, não por texto — os dois 409 dizem coisas diferentes', () => {
    // Casar por texto quebraria em silêncio quando a mensagem do servidor mudasse, e
    // trataria os dois 409 (mesmo status!) como se fossem o mesmo problema.
    const dependentes = getBillingPeriodErrorMessage(
      erroDaApi(409, 'COMPETENCIA_COM_CREDITOS_DEPENDENTES', 'Há créditos.'),
    )
    const jaAberta = getBillingPeriodErrorMessage(
      erroDaApi(409, 'COMPETENCIA_JA_ABERTA', 'Competência já está aberta.'),
    )

    expect(dependentes).not.toBe(jaAberta)
    expect(jaAberta).toContain('Atualize a lista')
    expect(jaAberta).not.toContain('confirmação de impacto')
  })

  it('422 conhecidos ganham a ação correspondente', () => {
    expect(
      getBillingPeriodErrorMessage(
        erroDaApi(422, 'COMPETENCIA_NAO_ENCERRADA', 'Competência não encerrada.'),
      ),
    ).toContain('já encerrada')
    expect(
      getBillingPeriodErrorMessage(erroDaApi(422, 'INVALID_COMPETENCIA', 'Formato inválido.')),
    ).toContain('AAAA-MM')
  })

  it('sem mensagem do servidor usa o padrão do código — e nunca fica vazio', () => {
    const mensagem = getBillingPeriodErrorMessage(erroDaApi(409, 'COMPETENCIA_JA_ABERTA'))
    expect(mensagem).toBe('Esta competência não está fechada. Atualize a lista — esta competência já está em aberto.')
  })

  it('não duplica a ação quando o servidor já a inclui', () => {
    const mensagem = getBillingPeriodErrorMessage(
      erroDaApi(409, 'COMPETENCIA_JA_ABERTA', 'Atualize a lista — esta competência já está em aberto.'),
    )
    expect(mensagem).toBe('Atualize a lista — esta competência já está em aberto.')
  })

  it('código DESCONHECIDO cai em handleApiError — sem inventar ação', () => {
    // Fica vermelho se alguém puser um `default` que sugira o que fazer sobre um erro cuja
    // causa o painel não conhece.
    const mensagem = getBillingPeriodErrorMessage(
      erroDaApi(409, 'CODIGO_QUE_NAO_EXISTE_AINDA', 'Algo aconteceu no servidor.'),
    )
    expect(mensagem).toBe('Algo aconteceu no servidor.')
  })

  it('403 e erro sem envelope caem no tratamento central', () => {
    expect(getBillingPeriodErrorMessage(erroDaApi(403))).toBe(
      'Você não tem permissão para realizar esta ação.',
    )
    expect(getBillingPeriodErrorMessage(new Error('boom'))).toBe('Ocorreu um erro inesperado.')
  })
})

describe('leitores do envelope', () => {
  it('lêem código e mensagem, e devolvem null quando não há', () => {
    expect(codigoDoErro(erroDaApi(409, 'X', 'y'))).toBe('X')
    expect(codigoDoErro(erroDaApi(409))).toBeNull()
    expect(codigoDoErro(new Error('boom'))).toBeNull()
    expect(mensagemDoServidor(erroDaApi(409, 'X', 'y'))).toBe('y')
    expect(mensagemDoServidor(erroDaApi(409, 'X', ''))).toBeNull()
  })
})
