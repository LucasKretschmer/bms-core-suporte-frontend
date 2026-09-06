import { api } from '../../../services/api'
import type { ApiResponse } from '../../../types/api'
import type {
  CalendarOptionDto,
  SupportPlanDto,
  SupportPlanRequest,
  UnmatchedPlanDto,
} from '../types/supportPlan'

/**
 * 124/F1 — serviços de planos de suporte.
 * O desempacotamento do envelope `ApiResponse` acontece **aqui**, nunca no componente.
 *
 * Contrato (arquitetura §3 "F1 — Planos"):
 * ```
 * GET    /api/v1/support-plans              [CoordenadorPlus]  → ApiResponse<SupportPlanDto[]>
 * POST   /api/v1/support-plans              [GerentePlus]      → ApiResponse<SupportPlanDto>
 * PUT    /api/v1/support-plans/{id:int}     [GerentePlus]      → ApiResponse<SupportPlanDto>
 * GET    /api/v1/support-plans/unmatched    [CoordenadorPlus]  → ApiResponse<UnmatchedPlanDto[]>
 * ```
 * `DELETE` existe (`AdminOnly`) e **não é consumido por esta tela** — remover plano com
 * clientes vinculados já é recusado com 409 pelo backend, e a tela de 124/F1 não pediu a
 * ação. Nada aqui a impede de ser acrescentada depois.
 *
 * ⚠️ Nenhuma requisição desta tela leva filtro em array — logo R-7 não muda nada aqui.
 * A instância `api` já serializa arrays no formato que o ASP.NET liga
 * (`paramsSerializer: { indexes: null }`, `services/api.ts:41`); o teste de wire abaixo
 * afirma que **nenhum** `params` é enviado, para que um filtro futuro seja uma decisão
 * consciente e não um acidente.
 */

const BASE = '/api/v1/support-plans'

export async function listSupportPlans(): Promise<SupportPlanDto[]> {
  const { data } = await api.get<ApiResponse<SupportPlanDto[]>>(BASE)
  return data.data
}

export async function createSupportPlan(payload: SupportPlanRequest): Promise<SupportPlanDto> {
  const { data } = await api.post<ApiResponse<SupportPlanDto>>(BASE, payload)
  return data.data
}

export async function updateSupportPlan(
  id: number,
  payload: SupportPlanRequest,
): Promise<SupportPlanDto> {
  const { data } = await api.put<ApiResponse<SupportPlanDto>>(`${BASE}/${id}`, payload)
  return data.data
}

/** Valores de plano vindos do HubSpot que não casaram com nenhum plano cadastrado. */
export async function listUnmatchedPlans(): Promise<UnmatchedPlanDto[]> {
  const { data } = await api.get<ApiResponse<UnmatchedPlanDto[]>>(`${BASE}/unmatched`)
  return data.data
}

/**
 * Calendários disponíveis para o seletor "Calendário do plano".
 *
 * `GET /api/v1/calendars` é da unidade **BE-F2F3** (onda 2) e ainda não existe. Por isso
 * o consumo é **opcional por desenho**: falha aqui degrada o seletor (só "Calendário
 * padrão"), nunca a tela de planos inteira — ver `usePlanCalendars`.
 */
export async function listCalendarOptions(): Promise<CalendarOptionDto[]> {
  const { data } = await api.get<ApiResponse<CalendarOptionDto[]>>('/api/v1/calendars')
  return data.data
}
