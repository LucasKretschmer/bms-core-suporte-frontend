import { api } from '../../../services/api'
import type { ApiResponse, PaginatedResponse } from '../../../types/api'
import type { HourCreditDto } from '../types/hourCredit'

/**
 * Serviços de Créditos de Horas (132/F5).
 *
 * Contrato (`arquitetura.md:891-923`):
 * ```
 * GET    /api/v1/hour-credits?…  → PaginatedResponse<HourCreditDto>   (envelope CRU)
 * POST   /api/v1/hour-credits    → ApiResponse<HourCreditDto>          201
 * PUT    /api/v1/hour-credits/{id} → ApiResponse<HourCreditDto>        200
 * DELETE /api/v1/hour-credits/{id} → 204
 * ```
 *
 * 🔴 **Os dois envelopes convivem** e errar um quebra a tela **sem erro de tipo**: a
 * listagem devolve `PaginatedResponse` cru (como os relatórios), enquanto `POST`/`PUT`
 * devolvem `ApiResponse<T>` (recurso único, `arquitetura.md` §11.1). O `.data` do envelope
 * é desempacotado **aqui**, nunca no componente — `serviceCategoriesService.ts:22-26`.
 */

const BASE = '/api/v1/hour-credits'

export type ListHourCreditsParams = {
  clientId?: number | null
  /** `"YYYY-MM"`. */
  competencia?: string | null
  /** Vocabulário do servidor; vazio ⇒ o parâmetro nem sai. */
  status?: string[]
  origem?: string | null
  search?: string | null
  sortBy?: string | null
  sortDirection?: 'asc' | 'desc'
  page: number
  pageSize: number
}

/**
 * Remove `null`, `undefined`, string vazia e **array vazio** dos params.
 *
 * O array vazio é o caso que o `cleanParams` dos relatórios (`reportsService.ts:327-330`)
 * não trata: `status: []` viraria `status=` na query — um valor vazio que o backend desta
 * demanda rejeita com `400 INVALID_STATUS` (fail-closed na borda,
 * `analise-backend.md` §7.2), transformando "sem filtro" em erro.
 */
function limparParams(params: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(params).filter(([, valor]) => {
      if (valor === null || valor === undefined || valor === '') return false
      if (Array.isArray(valor) && valor.length === 0) return false
      return true
    }),
  )
}

/**
 * Lista os créditos (paginado, server-side).
 *
 * `status` viaja como **array** e a instância `api` o serializa em formato "repeat"
 * (`status=vigente&status=expirado`), sem índices — `services/api.ts:40`
 * (`paramsSerializer: { indexes: null }`). É o único formato que o model binding do
 * ASP.NET liga a `string[]`; com índices o filtro seria **ignorado em silêncio** (memória
 * `contrato-wire-backend-frontend`).
 */
export async function listHourCredits(
  params: ListHourCreditsParams,
): Promise<PaginatedResponse<HourCreditDto>> {
  const { data } = await api.get<PaginatedResponse<HourCreditDto>>(BASE, {
    params: limparParams(params),
  })
  return data
}

/**
 * Cria um crédito manual.
 *
 * 🔴 O corpo tem **exatamente** `{ clientId, horas, motivoId }`. `origem`, `ticketId`,
 * `competencia`, `competenciaOrigem` e `criadoPorUserId` são derivados no servidor e
 * **nunca** vão no corpo (`rules/security.md`: "nunca aceitar `UserId`/`OrganizacaoId` no
 * body" — aceitar `origem` aqui deixaria o cliente forjar um crédito "automático").
 */
export async function createHourCredit(input: {
  clientId: number
  horas: number
  motivoId: number
}): Promise<HourCreditDto> {
  const { data } = await api.post<ApiResponse<HourCreditDto>>(BASE, {
    clientId: input.clientId,
    horas: input.horas,
    motivoId: input.motivoId,
  })
  return data.data
}

/** Edita horas e motivo. Editar crédito **automático** é permitido (PRD §6.3). */
export async function updateHourCredit(
  id: number,
  input: { horas: number; motivoId: number },
): Promise<HourCreditDto> {
  const { data } = await api.put<ApiResponse<HourCreditDto>>(`${BASE}/${id}`, {
    horas: input.horas,
    motivoId: input.motivoId,
  })
  return data.data
}

/** `204 No Content` (soft delete no servidor). */
export async function deleteHourCredit(id: number): Promise<void> {
  await api.delete(`${BASE}/${id}`)
}
