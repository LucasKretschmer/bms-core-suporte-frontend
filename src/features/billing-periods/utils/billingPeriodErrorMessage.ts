import { isAxiosError } from 'axios'
import { handleApiError } from '../../../utils/handleApiError'

/**
 * Mensagens de erro das mutations de competência (132/F7).
 *
 * Ramifica por **`error.code`**, nunca pelo texto: os dois `409` desta superfície
 * (`COMPETENCIA_COM_CREDITOS_DEPENDENTES` e `COMPETENCIA_JA_ABERTA`) exigem reações
 * diferentes do usuário, e casar por texto quebra em silêncio no dia em que a mensagem
 * do servidor mudar (mesmo espírito de `rules/api.md` § "Os dois 429 são coisas
 * diferentes"). A **mensagem do servidor é preservada** — é ela que traz a CONTAGEM de
 * créditos dependentes — e recebe o acréscimo do que fazer.
 */

/** Envelope de erro do backend: `{ error: { code, message } }` (camelCase). */
type ApiErrorBody = { error?: { code?: unknown; message?: unknown } }

function corpoDoErro(error: unknown): ApiErrorBody | undefined {
  if (!isAxiosError(error)) return undefined
  return error.response?.data as ApiErrorBody | undefined
}

/** `error.code` do envelope, ou `null`. Sem `any`. */
export function codigoDoErro(error: unknown): string | null {
  const code = corpoDoErro(error)?.error?.code
  return typeof code === 'string' && code.length > 0 ? code : null
}

/** Mensagem do envelope do backend, ou `null` se não houver. */
export function mensagemDoServidor(error: unknown): string | null {
  const message = corpoDoErro(error)?.error?.message
  return typeof message === 'string' && message.length > 0 ? message : null
}

/**
 * Ações por código. Cada frase diz **o que fazer**, e nenhuma afirma que o sistema
 * corrigiu ou vai corrigir alguma coisa (C-8 — o sistema não corrige nada sozinho).
 */
const ACAO_POR_CODIGO: Record<string, string> = {
  COMPETENCIA_COM_CREDITOS_DEPENDENTES:
    'Marque a confirmação de impacto para reabrir mesmo assim: os créditos existentes permanecem exatamente como estão.',
  COMPETENCIA_JA_ABERTA: 'Atualize a lista — esta competência já está em aberto.',
  COMPETENCIA_NAO_ENCERRADA: 'Só é possível fechar uma competência já encerrada.',
  INVALID_COMPETENCIA: 'Informe a competência no formato AAAA-MM.',
}

/** Usadas só quando o servidor não manda mensagem — nunca no lugar dela. */
const MENSAGEM_PADRAO_POR_CODIGO: Record<string, string> = {
  COMPETENCIA_COM_CREDITOS_DEPENDENTES:
    'Existem créditos vivos gerados por esta competência.',
  COMPETENCIA_JA_ABERTA: 'Esta competência não está fechada.',
  COMPETENCIA_NAO_ENCERRADA: 'Esta competência ainda não terminou.',
  INVALID_COMPETENCIA: 'Competência inválida.',
}

export function getBillingPeriodErrorMessage(error: unknown): string {
  const codigo = codigoDoErro(error)
  const acao = codigo === null ? undefined : ACAO_POR_CODIGO[codigo]
  if (codigo === null || acao === undefined) {
    // Código desconhecido (ou erro sem envelope) cai no tratamento central — que já sabe
    // lidar com 403/404/429/rede e nunca expõe detalhe técnico.
    return handleApiError(error)
  }

  const doServidor = mensagemDoServidor(error) ?? MENSAGEM_PADRAO_POR_CODIGO[codigo]
  return doServidor.includes(acao) ? doServidor : `${doServidor} ${acao}`
}
