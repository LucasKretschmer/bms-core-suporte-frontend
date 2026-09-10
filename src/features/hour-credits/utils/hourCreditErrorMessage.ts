import { isAxiosError } from 'axios'
import { handleApiError } from '../../../utils/handleApiError'

/**
 * Mensagem de erro das mutations de crédito de horas (132/F5).
 *
 * Ramifica por **`error.code`**, nunca por texto: `409 CREDITO_ESTORNADO` é o único
 * conflito previsto no `PUT` (`arquitetura.md:920`, `analise-backend.md` §7.2), e casar por
 * mensagem quebraria em silêncio no dia em que o servidor mudar a redação.
 *
 * A mensagem do servidor é **preservada** (é ela que diz *o que* aconteceu) e recebe o
 * acréscimo do que o usuário pode fazer. Fora dos códigos conhecidos, `handleApiError` —
 * que já cobre `403`, `404`, `429` e a falha de rede.
 */

type ApiErrorBody = { error?: { code?: unknown; message?: unknown } }

function corpo(error: unknown): ApiErrorBody | undefined {
  if (!isAxiosError(error)) return undefined
  return error.response?.data as ApiErrorBody | undefined
}

export function codigoDoErroDeCredito(error: unknown): string | null {
  const code = corpo(error)?.error?.code
  return typeof code === 'string' && code.length > 0 ? code : null
}

function mensagemDoServidor(error: unknown): string | null {
  const message = corpo(error)?.error?.message
  return typeof message === 'string' && message.length > 0 ? message : null
}

/**
 * Ação do `CREDITO_ESTORNADO`. **Não** promete "reative o crédito": não existe
 * des-estorno — a arquitetura é explícita (`arquitetura.md:869`: *"nunca 'des-estornar'"*),
 * e um crédito novo é o caminho real.
 */
export const CREDITO_ESTORNADO_ACAO =
  'Crédito estornado não pode ser alterado. Se for o caso, lance um novo crédito.'

const ACAO_POR_CODIGO: Record<string, string> = {
  CREDITO_ESTORNADO: CREDITO_ESTORNADO_ACAO,
}

/** Identidade do vocabulário de códigos tratados — travada por teste. */
export const CODIGOS_DE_ERRO_DE_CREDITO = ['CREDITO_ESTORNADO'] as const

export function getHourCreditErrorMessage(error: unknown): string {
  const codigo = codigoDoErroDeCredito(error)
  const acao = codigo === null ? undefined : ACAO_POR_CODIGO[codigo]
  if (acao === undefined) return handleApiError(error)

  const doServidor = mensagemDoServidor(error)
  if (doServidor === null) return acao
  return doServidor.includes(acao) ? doServidor : `${doServidor} ${acao}`
}
