import { isAxiosError } from 'axios'
import { handleApiError } from '../../../utils/handleApiError'
import {
  MOTIVO_DE_SISTEMA_EXPLICACAO,
  MOTIVO_DUPLICADO_ACAO,
  MOTIVO_EM_USO_ACAO,
} from '../hourCreditReasonTexts'

/**
 * Mensagem de erro das mutations de motivo de crédito (132/F6).
 *
 * 🔴 **Ramifica por `error.code`, nunca por status nem por texto.** São **três** conflitos
 * distintos sob o MESMO `409` (`analise-backend.md` §7.3) e cada um exige uma ação
 * diferente do usuário:
 *
 * | `code` | O que aconteceu | O que o usuário faz |
 * |---|---|---|
 * | `MOTIVO_DE_SISTEMA` | motivo semeado, protegido | nada — não dá |
 * | `MOTIVO_EM_USO` | há crédito vivo com este motivo | mexer nos créditos primeiro |
 * | `MOTIVO_DUPLICADO` | já existe motivo vivo com o nome | trocar o nome |
 *
 * Ramificar por **status** colapsaria os três numa ação só (é o limite do template
 * `categoryErrorMessage.ts:38-44`, que tem um conflito só); ramificar por **texto** quebra
 * em silêncio no dia em que a mensagem do servidor mudar — mesmo espírito de `rules/api.md`
 * § "Os dois 429 são coisas diferentes".
 *
 * A mensagem do servidor é **preservada** (é ela que diz *o que* aconteceu) e recebe o
 * acréscimo do que fazer.
 */

/** Envelope de erro do backend: `{ error: { code, message } }`. */
type ApiErrorBody = { error?: { code?: unknown; message?: unknown } }

function corpoDeErro(error: unknown): ApiErrorBody | undefined {
  if (!isAxiosError(error)) return undefined
  return error.response?.data as ApiErrorBody | undefined
}

/** `error.code` do envelope, ou `null`. Sem `any`. */
export function codigoDoErro(error: unknown): string | null {
  const code = corpoDeErro(error)?.error?.code
  return typeof code === 'string' && code.length > 0 ? code : null
}

/** Mensagem do envelope do backend, ou `null` quando não veio nenhuma. */
function mensagemDoServidor(error: unknown): string | null {
  const message = corpoDeErro(error)?.error?.message
  return typeof message === 'string' && message.length > 0 ? message : null
}

/**
 * Ação por código. Fora deste mapa, nenhuma ação é inventada — a mensagem do servidor
 * (ou o fallback de `handleApiError`) fala sozinha.
 */
const ACAO_POR_CODIGO: Record<string, string> = {
  MOTIVO_DE_SISTEMA: MOTIVO_DE_SISTEMA_EXPLICACAO,
  MOTIVO_EM_USO: MOTIVO_EM_USO_ACAO,
  MOTIVO_DUPLICADO: MOTIVO_DUPLICADO_ACAO,
}

/** Identidade do vocabulário de códigos tratados — travada por teste, não por contagem. */
export const CODIGOS_DE_CONFLITO_DE_MOTIVO = [
  'MOTIVO_DE_SISTEMA',
  'MOTIVO_DUPLICADO',
  'MOTIVO_EM_USO',
] as const

export function getHourCreditReasonErrorMessage(error: unknown): string {
  const codigo = codigoDoErro(error)
  const acao = codigo === null ? undefined : ACAO_POR_CODIGO[codigo]
  if (acao === undefined) return handleApiError(error)

  const doServidor = mensagemDoServidor(error)
  if (doServidor === null) return acao
  return doServidor.includes(acao) ? doServidor : `${doServidor} ${acao}`
}
