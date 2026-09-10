import { api } from '../../../services/api'
import type { ApiResponse } from '../../../types/api'
import type { HourCreditReasonDto } from '../types/hourCreditReason'

/**
 * Serviços de Motivos de Crédito (132/F6).
 *
 * Contrato (`arquitetura.md:880-884` · `analise-backend.md` §7.3):
 * ```
 * GET    /api/v1/hour-credit-reasons?includeInactive=false → ApiResponse<HourCreditReasonDto[]>
 * POST   /api/v1/hour-credit-reasons        { nome }       → 201 · 409 · 422
 * PUT    /api/v1/hour-credit-reasons/{id}   { nome }       → 200 · 404 · 409 · 422
 * DELETE /api/v1/hour-credit-reasons/{id}                  → 204 · 404 · 409
 * ```
 *
 * **Sem paginação** — poucos registros, envelope `ApiResponse` (`rules/api.md`
 * § "Quando NÃO paginar").
 *
 * O desempacotamento de `.data` acontece **aqui**, nunca no componente — template
 * `serviceCategoriesService.ts:22-26`.
 */

const BASE = '/api/v1/hour-credit-reasons'

/**
 * Lista os motivos. `includeInactive` viaja **sempre explícito**, inclusive `false`: omitir
 * deixaria o default do servidor decidir o conteúdo da tela, e o painel passaria a exibir
 * um conjunto diferente do que pediu sem ninguém perceber.
 */
export async function listHourCreditReasons(
  includeInactive: boolean,
): Promise<HourCreditReasonDto[]> {
  const { data } = await api.get<ApiResponse<HourCreditReasonDto[]>>(BASE, {
    params: { includeInactive },
  })
  return data.data
}

export async function createHourCreditReason(nome: string): Promise<HourCreditReasonDto> {
  const { data } = await api.post<ApiResponse<HourCreditReasonDto>>(BASE, { nome })
  return data.data
}

export async function updateHourCreditReason(
  id: number,
  nome: string,
): Promise<HourCreditReasonDto> {
  const { data } = await api.put<ApiResponse<HourCreditReasonDto>>(`${BASE}/${id}`, { nome })
  return data.data
}

/** `204 No Content` — sem envelope para desempacotar. */
export async function deleteHourCreditReason(id: number): Promise<void> {
  await api.delete(`${BASE}/${id}`)
}
