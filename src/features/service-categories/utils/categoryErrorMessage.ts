import { isAxiosError } from 'axios'
import { handleApiError } from '../../../utils/handleApiError'

/**
 * Ação que resolve o conflito, seja qual for o motivo do 409. Vale tanto para o conflito
 * que o backend já devolve hoje (outra categoria **ativa** com o mesmo nome) quanto para o
 * que a unidade BE-2 está acrescentando (categoria **desativada** com o mesmo nome, que
 * hoje vaza como 500).
 */
const DICA_CONFLITO = 'Escolha um nome diferente.'

/** Usada só quando o 409 chega sem mensagem no envelope — nunca no lugar dela. */
const CONFLITO_SEM_MENSAGEM = 'Já existe uma categoria com este nome.'

/** Envelope de erro do backend: `{ error: { code, message } }` (camelCase). */
type ApiErrorBody = { error?: { message?: unknown } }

/** Mensagem do envelope do backend, ou `null` se não houver. Sem `any`. */
function mensagemDoServidor(error: unknown): string | null {
  if (!isAxiosError(error)) return null
  const body = error.response?.data as ApiErrorBody | undefined
  const message = body?.error?.message
  return typeof message === 'string' && message.length > 0 ? message : null
}

/**
 * Mensagem de erro das mutations de categoria (criar e renomear).
 *
 * O 409 é reconhecido pelo **status HTTP**, nunca pelo texto da mensagem — de propósito:
 * a unidade BE-2 está acrescentando um segundo motivo de conflito (nome de categoria
 * desativada) com **outra** mensagem. Qualquer casamento por texto passaria a ignorar o
 * caso novo em silêncio, exibindo "Ocorreu um erro inesperado." para um erro que o
 * backend explica.
 *
 * A mensagem do servidor é **preservada** (é ela que diz *o que* aconteceu, e é ela que
 * vai mudar com o BE-2) e recebe o acréscimo do que o usuário deve fazer.
 */
export function getCategoryMutationErrorMessage(error: unknown): string {
  const isConflito = isAxiosError(error) && error.response?.status === 409
  if (!isConflito) return handleApiError(error)

  const doServidor = mensagemDoServidor(error) ?? CONFLITO_SEM_MENSAGEM
  return doServidor.includes(DICA_CONFLITO) ? doServidor : `${doServidor} ${DICA_CONFLITO}`
}
