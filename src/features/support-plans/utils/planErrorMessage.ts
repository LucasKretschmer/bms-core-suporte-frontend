import { isAxiosError } from 'axios'
import { handleApiError } from '../../../utils/handleApiError'
import type { SupportPlanFormValues } from '../types/supportPlan'

/**
 * 124/F1 — tradução dos erros específicos de plano de suporte.
 *
 * ## Por que existe (R-1, `arquitetura.md` §6 — RISCO ALTO)
 *
 * O vínculo cliente↔plano é resolvido **pelo nome do plano**
 * (`CompanySyncService.cs:330-341`, `IngestService.cs:841-858`). Renomear um plano sem
 * identificador estável do HubSpot **desvincula todos os clientes daquele plano**, e o
 * efeito aparece como horas erradas na fatura — sem erro nenhum na tela. O backend
 * (unidade BE-F1) recusa com `422 PLAN_RENAME_UNSAFE`; aqui esse código **nunca** pode
 * cair no toast genérico "Ocorreu um erro inesperado.", que não diz o que fazer.
 *
 * ## Reconhecimento por CÓDIGO, nunca por texto
 *
 * O discriminador é `error.code` do envelope (`rules/api.md` — `{ error: { code, message,
 * details[] } }`). Casar por texto quebraria em silêncio na primeira vez que alguém
 * ajustasse a redação no backend, e o usuário voltaria ao toast genérico. Mesmo princípio
 * já aplicado em `features/service-categories/utils/categoryErrorMessage.ts`.
 *
 * ## A mensagem do servidor é PRESERVADA
 *
 * É ela que diz *o que* aconteceu (e pode citar quantos clientes serão afetados, número
 * que só o backend tem). O acréscimo local é a **ação** — e só entra quando ainda não
 * está lá.
 */

/** Códigos de erro específicos de plano (arquitetura §3, "Erros específicos"). */
export const PLAN_ERROR_CODES = {
  /** 422 — alterar `nome` com `hubspotValor == null` e `clientesVinculados > 0`. */
  RENAME_UNSAFE: 'PLAN_RENAME_UNSAFE',
  /** 422 — `slaIsento == true` com `slaPrimeiroAtendimentoMinutos != null`. */
  SLA_CONFLICT: 'PLAN_SLA_CONFLICT',
  /** 409 — `hubspotValor` já usado por outro plano (índice único de M1). */
  HUBSPOT_VALUE_DUPLICATE: 'PLAN_HUBSPOT_VALUE_DUPLICATE',
} as const

/** Campo do formulário para onde o erro aponta (foco + erro inline). */
export type PlanErrorField = keyof SupportPlanFormValues

export type PlanErrorInfo = {
  /** Código do envelope, quando houver. `null` para erro sem envelope (rede, 500…). */
  code: string | null
  /** Texto exibido ao usuário — sempre em português, sempre acionável quando dá. */
  message: string
  /** Campo a receber foco e erro inline. `null` = erro geral do formulário. */
  field: PlanErrorField | null
}

/**
 * Ação que resolve o rename inseguro. Redação alinhada à recomendação da arquitetura
 * (§4 ponto 4, item 4): *"Preencha o identificador do HubSpot deste plano antes de
 * renomeá-lo, senão os clientes deixarão de ser associados."*
 */
const ACAO_RENAME_UNSAFE =
  'Preencha o identificador do HubSpot deste plano antes de renomeá-lo.'

/** Usada só quando o 422 chega sem mensagem no envelope — nunca no lugar dela. */
const RENAME_UNSAFE_SEM_MENSAGEM =
  'Renomear este plano desvincularia os clientes que hoje são associados a ele pelo nome.'

const SLA_CONFLICT_SEM_MENSAGEM =
  'Plano isento não pode ter meta de 1º atendimento.'
const ACAO_SLA_CONFLICT = 'Limpe a meta ou desmarque a isenção.'

const HUBSPOT_DUPLICATE_SEM_MENSAGEM =
  'Já existe outro plano com este identificador do HubSpot.'
const ACAO_HUBSPOT_DUPLICATE = 'Use um identificador diferente.'

/** Envelope de erro do backend: `{ error: { code, message, details[] } }` (camelCase). */
type ApiErrorBody = {
  error?: {
    code?: unknown
    message?: unknown
    details?: unknown
  }
}

function corpoDoErro(error: unknown): ApiErrorBody['error'] | undefined {
  if (!isAxiosError(error)) return undefined
  const body = error.response?.data as ApiErrorBody | undefined
  return body?.error
}

/** Código do envelope, ou `null`. Sem `any`. */
export function getPlanErrorCode(error: unknown): string | null {
  const code = corpoDoErro(error)?.code
  return typeof code === 'string' && code.length > 0 ? code : null
}

function mensagemDoServidor(error: unknown): string | null {
  const message = corpoDoErro(error)?.message
  return typeof message === 'string' && message.length > 0 ? message : null
}

/** Junta a mensagem do servidor (ou o fallback) com a ação, sem duplicar a ação. */
function comAcao(doServidor: string | null, fallback: string, acao: string): string {
  const base = doServidor ?? fallback
  return base.includes(acao) ? base : `${base} ${acao}`
}

/**
 * Traduz o erro de uma mutation de plano em mensagem + campo de destino.
 *
 * Qualquer erro fora dos três códigos conhecidos cai em `handleApiError`, que já
 * preserva a mensagem do envelope quando existe.
 */
export function getPlanMutationError(error: unknown): PlanErrorInfo {
  const code = getPlanErrorCode(error)
  const doServidor = mensagemDoServidor(error)

  switch (code) {
    case PLAN_ERROR_CODES.RENAME_UNSAFE:
      return {
        code,
        message: comAcao(doServidor, RENAME_UNSAFE_SEM_MENSAGEM, ACAO_RENAME_UNSAFE),
        // O campo a corrigir é o identificador — não o nome. Mandar o usuário de volta
        // ao nome que ele acabou de digitar seria pedir que ele desfizesse a intenção.
        field: 'hubspotValor',
      }
    case PLAN_ERROR_CODES.SLA_CONFLICT:
      return {
        code,
        message: comAcao(doServidor, SLA_CONFLICT_SEM_MENSAGEM, ACAO_SLA_CONFLICT),
        field: 'slaPrimeiroAtendimentoMinutos',
      }
    case PLAN_ERROR_CODES.HUBSPOT_VALUE_DUPLICATE:
      return {
        code,
        message: comAcao(doServidor, HUBSPOT_DUPLICATE_SEM_MENSAGEM, ACAO_HUBSPOT_DUPLICATE),
        field: 'hubspotValor',
      }
    default:
      return { code, message: handleApiError(error), field: null }
  }
}

/** Atalho para os pontos que só precisam do texto (toast). */
export function getPlanMutationErrorMessage(error: unknown): string {
  return getPlanMutationError(error).message
}

/**
 * Aviso **preventivo** de rename inseguro, exibido enquanto o usuário digita — antes de
 * o backend recusar. Não bloqueia o envio: o backend é a fonte de verdade, e bloquear na
 * UI esconderia o caso em que a guarda do servidor mudou.
 *
 * A condição é a mesma da guarda do backend (arquitetura §4 ponto 4, item 4): nome
 * alterado **e** identificador do HubSpot vazio **e** há clientes vinculados.
 */
export function shouldWarnUnsafeRename(args: {
  nomeOriginal: string
  nomeAtual: string
  hubspotValorAtual: string
  clientesVinculados: number
}): boolean {
  const nomeMudou = args.nomeAtual.trim() !== args.nomeOriginal.trim()
  const semIdentificador = args.hubspotValorAtual.trim().length === 0
  return nomeMudou && semIdentificador && args.clientesVinculados > 0
}

/** Texto do aviso preventivo — o número de clientes vem do DTO, nunca é digitado. */
export function textoAvisoRenameInseguro(clientesVinculados: number): string {
  const plural = clientesVinculados === 1 ? 'cliente vinculado' : 'clientes vinculados'
  return (
    `Este plano tem ${clientesVinculados} ${plural} e nenhum identificador do HubSpot. ` +
    'Os clientes são associados pelo NOME do plano, então renomeá-lo desvincularia todos eles. ' +
    ACAO_RENAME_UNSAFE
  )
}
