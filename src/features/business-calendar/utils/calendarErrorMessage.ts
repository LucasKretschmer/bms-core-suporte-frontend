import { isAxiosError } from 'axios'
import { handleApiError } from '../../../utils/handleApiError'

/**
 * 124/F2+F3 — tradução dos erros do calendário comercial.
 *
 * ## Reconhecimento por CÓDIGO, nunca por texto
 *
 * O discriminador é `error.code` do envelope (`rules/api.md`:
 * `{ error: { code, message, details[] } }`). Casar por texto quebraria em silêncio na
 * primeira vez que alguém ajustasse a redação no backend — mesmo princípio de
 * `features/support-plans/utils/planErrorMessage.ts` e
 * `features/service-categories/utils/categoryErrorMessage.ts`.
 *
 * Os códigos são os literais de `Suporte.Domain/Config/CalendarioConflitos.cs`.
 *
 * ## A mensagem do servidor é PRESERVADA
 *
 * Ela é a única que sabe **quantos** planos usam o calendário, **qual** data duplicou e
 * **quais** linhas do arquivo falharam. O acréscimo local é a ação, e só quando falta.
 */

export const CALENDAR_ERROR_CODES = {
  /** 409 — já existe calendário ativo com este nome. */
  NAME_DUPLICATE: 'CALENDAR_NAME_DUPLICATE',
  /** 409 — despromover/remover o **último** calendário padrão. */
  LAST_DEFAULT: 'CALENDAR_LAST_DEFAULT',
  /** 409 — corrida no índice único de `padrao`. */
  DEFAULT_CONFLICT: 'CALENDAR_DEFAULT_CONFLICT',
  /** 409 — calendário vinculado a planos de suporte. */
  IN_USE: 'CALENDAR_IN_USE',
  /** 422 — janela inválida ou sobreposta (inclui `fim <= inicio`, DD-5). */
  WINDOW_OVERLAP: 'SCHEDULE_WINDOW_OVERLAP',
  /** 422 — já existe versão de expediente com a mesma `vigenciaInicio`. */
  VIGENCIA_DUPLICADA: 'SCHEDULE_VIGENCIA_DUPLICADA',
  /** 409 — já existe feriado nesta data neste calendário. */
  HOLIDAY_DATE_DUPLICATE: 'HOLIDAY_DATE_DUPLICATE',
  /** 422 — **tudo ou nada**: uma linha inválida recusa o lote inteiro (AUTO-124-9). */
  IMPORT_INVALID_ROWS: 'IMPORT_INVALID_ROWS',
  /** 422 — mais de 500 itens numa requisição. */
  IMPORT_TOO_MANY_ROWS: 'IMPORT_TOO_MANY_ROWS',
} as const

/** Um item de `details[]` do envelope de erro. */
export type DetalheDeErro = { field: string; message: string }

type CorpoDeErro = {
  error?: {
    code?: unknown
    message?: unknown
    details?: unknown
  }
}

function corpoDoErro(error: unknown): CorpoDeErro['error'] | undefined {
  if (!isAxiosError(error)) return undefined
  const body = error.response?.data as CorpoDeErro | undefined
  return body?.error
}

/** `error.code` do envelope, ou `null`. Sem `any`. */
export function getCalendarErrorCode(error: unknown): string | null {
  const code = corpoDoErro(error)?.code
  return typeof code === 'string' && code.length > 0 ? code : null
}

/** `details[]` do envelope, já filtrado para itens com os dois campos string. */
export function getCalendarErrorDetails(error: unknown): DetalheDeErro[] {
  const details = corpoDoErro(error)?.details
  if (!Array.isArray(details)) return []
  return details.filter((item): item is DetalheDeErro => {
    if (typeof item !== 'object' || item === null) return false
    const candidato = item as { field?: unknown; message?: unknown }
    return typeof candidato.field === 'string' && typeof candidato.message === 'string'
  })
}

const ACOES: Record<string, string> = {
  [CALENDAR_ERROR_CODES.LAST_DEFAULT]:
    'Marque outro calendário como padrão antes de mudar este.',
  [CALENDAR_ERROR_CODES.NAME_DUPLICATE]: 'Escolha outro nome.',
  [CALENDAR_ERROR_CODES.VIGENCIA_DUPLICADA]:
    'Escolha outra data de início de vigência ou edite a versão existente.',
  [CALENDAR_ERROR_CODES.HOLIDAY_DATE_DUPLICATE]:
    'Edite o feriado que já existe nessa data.',
  [CALENDAR_ERROR_CODES.IMPORT_INVALID_ROWS]:
    'Nenhuma linha foi gravada: corrija os itens listados e reenvie o arquivo.',
  [CALENDAR_ERROR_CODES.IMPORT_TOO_MANY_ROWS]: 'Divida o arquivo e importe em partes.',
}

/**
 * Mensagem para o usuário. Mantém a do servidor e acrescenta a ação quando ela ainda
 * não está lá; qualquer código desconhecido cai em `handleApiError`, que já preserva a
 * mensagem do envelope.
 */
export function getCalendarErrorMessage(error: unknown): string {
  const code = getCalendarErrorCode(error)
  const doServidor = corpoDoErro(error)?.message
  const base = typeof doServidor === 'string' && doServidor.length > 0 ? doServidor : null

  if (code === null || ACOES[code] === undefined) return handleApiError(error)

  const acao = ACOES[code]
  const texto = base ?? 'A operação não pôde ser concluída.'
  return texto.includes(acao) ? texto : `${texto} ${acao}`
}

/**
 * Erro de **uma linha** da importação, já ligado ao índice do item enviado.
 *
 * O backend devolve `field: "itens[3].data"` (`HolidayService.ValidarLinhas`), onde `3`
 * é o índice **no array enviado** — que não é o número da linha no arquivo, porque o
 * cabeçalho e as linhas em branco não viajam. Traduzir um no outro é responsabilidade de
 * quem monta o array (a tela guarda o número da linha de cada item).
 */
export type ErroDeItemImportado = {
  /** Índice no array `itens` enviado. */
  indice: number
  /** `data` ou `nome`. */
  campo: string
  mensagem: string
}

const CAMPO_DE_ITEM = /^itens\[(\d+)\]\.(\w+)$/

/**
 * Lê `details[]` do `422 IMPORT_INVALID_ROWS` e devolve os erros **linha a linha**.
 *
 * É isto que impede o toast genérico exigido pelo enunciado: o usuário precisa ver
 * *qual* linha reprovou e *por quê*, senão a recusa total (AUTO-124-9) vira um beco sem
 * saída. Detalhes com `field` fora do padrão `itens[N].campo` não são descartados — vão
 * para `outros`, para que nada do servidor suma da tela.
 */
export function errosDeImportacao(error: unknown): {
  porItem: ErroDeItemImportado[]
  outros: DetalheDeErro[]
} {
  const porItem: ErroDeItemImportado[] = []
  const outros: DetalheDeErro[] = []

  for (const detalhe of getCalendarErrorDetails(error)) {
    const casamento = CAMPO_DE_ITEM.exec(detalhe.field)
    if (casamento === null) {
      outros.push(detalhe)
      continue
    }
    porItem.push({
      indice: Number(casamento[1]),
      campo: casamento[2],
      mensagem: detalhe.message,
    })
  }

  return { porItem, outros }
}
