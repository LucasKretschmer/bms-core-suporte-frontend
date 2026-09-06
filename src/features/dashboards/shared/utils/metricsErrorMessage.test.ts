import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios'
import { describe, expect, it } from 'vitest'
import {
  ACAO_JANELA_GRANDE_DEMAIS,
  JANELA_GRANDE_DEMAIS_SEM_MENSAGEM,
  METRICS_ERROR_CODES,
  getMetricsErrorCode,
  mensagemDeJanelaGrandeDemais,
} from './metricsErrorMessage'

/**
 * 124/FE-P3 — o `422` de janela grande demais (`S-1`/`BE-FIX1`).
 *
 * A frase abaixo é a do backend, **copiada literalmente** de
 * `DateRangeGuard.RangeTooLargeErrorMessage` (`DateRangeGuard.cs:56-58`) — é ela que o
 * envelope carrega, e é dela que sai o número `366`. Nenhuma asserção deste arquivo
 * deriva o esperado da resposta: os literais estão escritos à mão.
 */
const MENSAGEM_DO_BACKEND =
  'O período não pode ser maior que 1 ano (366 dias). ' +
  'Escolha um intervalo menor — por exemplo um mês, ou o ano corrente — e consulte os ' +
  'períodos anteriores em consultas separadas.'

/** Erro com o envelope real do backend (`{ error: { code, message } }`, camelCase). */
function erroApi(status: number, code: string | null, message: string | null): AxiosError {
  const config = { headers: new AxiosHeaders() }
  const error: Record<string, unknown> = {}
  if (code != null) error.code = code
  if (message != null) error.message = message
  const response: AxiosResponse = {
    data: { error },
    status,
    statusText: '',
    headers: {},
    config,
  }
  return new AxiosError(`Request failed with status code ${status}`, undefined, config, {}, response)
}

describe('getMetricsErrorCode', () => {
  it('extrai o código do envelope', () => {
    expect(getMetricsErrorCode(erroApi(422, 'DATE_RANGE_TOO_LARGE', 'x'))).toBe(
      'DATE_RANGE_TOO_LARGE',
    )
  })

  it('devolve null para erro sem envelope, sem code e para não-Axios', () => {
    expect(getMetricsErrorCode(erroApi(500, null, null))).toBeNull()
    expect(getMetricsErrorCode(new Error('boom'))).toBeNull()
    expect(getMetricsErrorCode(undefined)).toBeNull()
  })
})

describe('mensagemDeJanelaGrandeDemais — 422 DATE_RANGE_TOO_LARGE', () => {
  it('preserva a mensagem do servidor INTEIRA — é ela que diz qual é o máximo', () => {
    // O que faz este assert ficar vermelho: descartar a mensagem do envelope (o toast
    // genérico de hoje) ou reescrevê-la localmente. O `366` só existe do lado do
    // servidor; se ele sumir daqui, o usuário volta a descobrir o teto por tentativa.
    const texto = mensagemDeJanelaGrandeDemais(
      erroApi(422, METRICS_ERROR_CODES.DATE_RANGE_TOO_LARGE, MENSAGEM_DO_BACKEND),
    )

    expect(texto).toBe(`${MENSAGEM_DO_BACKEND} ${ACAO_JANELA_GRANDE_DEMAIS}`)
    expect(texto).toContain('366 dias')
    expect(texto).toContain('Ajuste o filtro de período.')
  })

  it('o número do teto NÃO está cravado no código do frontend', () => {
    // Segunda fonte de verdade é o defeito que esta demanda inteira existe para
    // eliminar: sem mensagem no envelope, a frase de fallback não inventa um limite.
    const semMensagem = mensagemDeJanelaGrandeDemais(
      erroApi(422, METRICS_ERROR_CODES.DATE_RANGE_TOO_LARGE, null),
    )

    expect(semMensagem).toBe(
      `${JANELA_GRANDE_DEMAIS_SEM_MENSAGEM} ${ACAO_JANELA_GRANDE_DEMAIS}`,
    )
    expect(semMensagem).not.toMatch(/\d/)
  })

  it('não duplica a ação quando o servidor já a escreveu', () => {
    const jaComAcao = `Período longo demais. ${ACAO_JANELA_GRANDE_DEMAIS}`
    expect(
      mensagemDeJanelaGrandeDemais(
        erroApi(422, METRICS_ERROR_CODES.DATE_RANGE_TOO_LARGE, jaComAcao),
      ),
    ).toBe(jaComAcao)
  })

  it('COMPANHEIRA POSITIVA: qualquer outro código continua sem tratamento próprio', () => {
    // Se esta passar a devolver texto, o tratamento deixou de discriminar e o genérico
    // de cada tela some — o oposto do que a unidade entrega.
    expect(mensagemDeJanelaGrandeDemais(erroApi(422, 'INVALID_DATE_RANGE', 'x'))).toBeNull()
    expect(mensagemDeJanelaGrandeDemais(erroApi(422, 'DATE_OUT_OF_RANGE', 'x'))).toBeNull()
    expect(mensagemDeJanelaGrandeDemais(erroApi(500, 'INTERNAL', 'x'))).toBeNull()
    expect(mensagemDeJanelaGrandeDemais(erroApi(403, 'FORBIDDEN', 'x'))).toBeNull()
    expect(mensagemDeJanelaGrandeDemais(new Error('Network Error'))).toBeNull()
    expect(mensagemDeJanelaGrandeDemais(null)).toBeNull()
  })

  it('o código é reconhecido pelo CÓDIGO, nunca pelo texto da mensagem', () => {
    // Mensagem idêntica à do backend, código diferente → nada. Prova que o discriminador
    // não é o texto (que muda com qualquer ajuste de redação no servidor).
    expect(
      mensagemDeJanelaGrandeDemais(erroApi(422, 'OUTRO_CODIGO', MENSAGEM_DO_BACKEND)),
    ).toBeNull()
  })
})
