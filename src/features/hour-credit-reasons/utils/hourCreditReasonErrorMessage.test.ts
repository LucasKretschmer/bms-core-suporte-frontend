import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios'
import { describe, expect, it } from 'vitest'
import {
  CODIGOS_DE_CONFLITO_DE_MOTIVO,
  getHourCreditReasonErrorMessage,
} from './hourCreditReasonErrorMessage'
import {
  MOTIVO_DE_SISTEMA_EXPLICACAO,
  MOTIVO_DUPLICADO_ACAO,
  MOTIVO_EM_USO_ACAO,
} from '../hourCreditReasonTexts'

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

describe('getHourCreditReasonErrorMessage — três 409 diferentes, três ações diferentes', () => {
  it('a identidade do vocabulário de códigos é esta', () => {
    // Código novo no servidor sem tratamento aqui reprova, nomeando a diferença.
    expect([...CODIGOS_DE_CONFLITO_DE_MOTIVO]).toEqual([
      'MOTIVO_DE_SISTEMA',
      'MOTIVO_DUPLICADO',
      'MOTIVO_EM_USO',
    ])
  })

  it('🔴 os três 409 produzem mensagens DIFERENTES — ramificação por `code`', () => {
    // Ramificar por STATUS colapsaria os três numa ação só (é o limite do template
    // `categoryErrorMessage`, que tem um conflito só). Este assert é o que impede a
    // regressão para "um 409, uma mensagem".
    const sistema = getHourCreditReasonErrorMessage(erro(409, 'MOTIVO_DE_SISTEMA', 'Recusado.'))
    const emUso = getHourCreditReasonErrorMessage(erro(409, 'MOTIVO_EM_USO', 'Recusado.'))
    const duplicado = getHourCreditReasonErrorMessage(erro(409, 'MOTIVO_DUPLICADO', 'Recusado.'))

    expect(new Set([sistema, emUso, duplicado]).size).toBe(3)
    expect(sistema).toContain(MOTIVO_DE_SISTEMA_EXPLICACAO)
    expect(emUso).toContain(MOTIVO_EM_USO_ACAO)
    expect(duplicado).toContain(MOTIVO_DUPLICADO_ACAO)
  })

  it('a mensagem do servidor é PRESERVADA — é ela que diz o que aconteceu', () => {
    const texto = getHourCreditReasonErrorMessage(
      erro(409, 'MOTIVO_EM_USO', 'O motivo 2 tem 7 créditos ativos.'),
    )
    // Trocar a mensagem do servidor por texto fixo apagaria os números — a única
    // informação que permite ao gerente agir.
    expect(texto).toContain('O motivo 2 tem 7 créditos ativos.')
    expect(texto).toContain(MOTIVO_EM_USO_ACAO)
  })

  it('🔴 a ação do MOTIVO_EM_USO não manda "desativar" — a tela não tem como', () => {
    // `AP-FRONTEND-022`: o contrato desta demanda não expõe desativação de motivo
    // (`PUT { nome }`, sem `PATCH`). Instruir uma ação inexistente é texto que mente.
    expect(MOTIVO_EM_USO_ACAO).not.toMatch(/desativ/i)
    expect(MOTIVO_EM_USO_ACAO).toMatch(/créditos/i)
  })

  it('409 desconhecido cai no genérico — sem ação inventada', () => {
    const texto = getHourCreditReasonErrorMessage(erro(409, 'OUTRO', 'Conflito qualquer.'))
    expect(texto).toBe('Conflito qualquer.')
  })

  it('409 sem mensagem no envelope usa só a ação', () => {
    expect(getHourCreditReasonErrorMessage(erro(409, 'MOTIVO_DUPLICADO', undefined))).toBe(
      MOTIVO_DUPLICADO_ACAO,
    )
  })

  it('erro sem envelope cai no handleApiError, sem vazar detalhe técnico', () => {
    expect(getHourCreditReasonErrorMessage(new Error('boom'))).toBe('Ocorreu um erro inesperado.')
  })
})
