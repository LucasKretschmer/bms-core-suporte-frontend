import { api } from '../../../services/api'
import type { ApiResponse, PaginatedResponse } from '../../../types/api'
import type {
  BillingPeriodComparisonItemDto,
  BillingPeriodDto,
  ReabrirCompetenciaBody,
} from '../types/billingPeriod'

/**
 * Competências de faturamento (132/F7) — `arquitetura.md` §11.4 e §8.2.
 *
 * 🔴 **Os dois envelopes convivem, e o desempacotamento é AQUI, nunca no componente**
 * (`rules/api.md` § "Conferir o shape de CADA endpoint"):
 *
 * | Rota | Envelope |
 * |---|---|
 * | `GET /billing-periods` | `PaginatedResponse<T>` **cru** (`{items,totalCount,…}`) |
 * | `GET /billing-periods/{competencia}` | `ApiResponse<T>` ⇒ desempacota `.data` |
 * | `POST …/close` · `POST …/reopen` | efeito, sem corpo consumido — ver abaixo |
 * | `GET …/{competencia}/comparison` | `PaginatedResponse<T>` **cru** |
 */

const BASE = '/api/v1/billing-periods'

/**
 * `competencia` entra na URL como segmento. `encodeURIComponent` mesmo sabendo que
 * `"2026-08"` é inócuo: o valor vem de query string / da rede, e concatenar entrada na
 * URL sem escapar é o hábito errado, não este caso.
 */
function rotaDa(competencia: string): string {
  return `${BASE}/${encodeURIComponent(competencia)}`
}

export type ListBillingPeriodsParams = {
  page?: number
  pageSize?: number
}

export async function listBillingPeriods(
  params: ListBillingPeriodsParams = {},
): Promise<PaginatedResponse<BillingPeriodDto>> {
  const { data } = await api.get<PaginatedResponse<BillingPeriodDto>>(BASE, {
    params: { page: params.page ?? 1, pageSize: params.pageSize ?? 25 },
  })
  return data
}

export async function getBillingPeriod(competencia: string): Promise<BillingPeriodDto> {
  const { data } = await api.get<ApiResponse<BillingPeriodDto>>(rotaDa(competencia))
  return data.data
}

/**
 * Fecha (ou **refecha**, quando a competência está reaberta) a competência.
 *
 * A resposta **não é consumida**: o contrato diz `200 (idempotente: já fechada ⇒ 200 sem
 * efeito)` sem fixar o corpo (`arquitetura.md` §11.4). Ler um corpo que o contrato não
 * promete criaria dependência de algo que pode não vir; quem atualiza a tela é a
 * invalidação das queries.
 */
export async function closeBillingPeriod(competencia: string): Promise<void> {
  await api.post(`${rotaDa(competencia)}/close`)
}

/**
 * Reabre a competência (C-8).
 *
 * 🔴 O corpo tem **exatamente dois campos**. Nada de `usuario`, `competencia` repetida no
 * body ou qualquer campo derivável do token/da URL (`security.md` § "nunca aceitar no
 * body"). Travado por asserção de **identidade das chaves** no teste — `toMatchObject`
 * passaria com campos a mais.
 */
export async function reopenBillingPeriod(
  competencia: string,
  body: ReabrirCompetenciaBody,
): Promise<void> {
  await api.post(`${rotaDa(competencia)}/reopen`, {
    motivo: body.motivo,
    confirmarImpactoEmCreditos: body.confirmarImpactoEmCreditos,
  })
}

export type ListComparisonParams = {
  competencia: string
  clientId?: number | null
  page?: number
  pageSize?: number
}

/**
 * A comparação de auditoria (D12 · `arquitetura.md` §8.2): snapshot × cálculo atual,
 * cliente a cliente, paginada.
 *
 * `clientId` só viaja quando há filtro — mandar `clientId: null` faria o ASP.NET receber
 * a chave vazia. Mesmo hábito do `cleanParams` dos relatórios.
 */
export async function listBillingPeriodComparison(
  params: ListComparisonParams,
): Promise<PaginatedResponse<BillingPeriodComparisonItemDto>> {
  const { competencia, clientId, page, pageSize } = params
  const { data } = await api.get<PaginatedResponse<BillingPeriodComparisonItemDto>>(
    `${rotaDa(competencia)}/comparison`,
    {
      params: {
        page: page ?? 1,
        pageSize: pageSize ?? 25,
        ...(clientId == null ? {} : { clientId }),
      },
    },
  )
  return data
}
