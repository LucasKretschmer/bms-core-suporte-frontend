import { api } from '../../../services/api'
import type { ApiResponse } from '../../../types/api'

/**
 * Opções para os combos do TimeEntryModal (atendente e categorização).
 * Serviços dedicados ao modal para não acoplar à feature de telas isoladas
 * (categorias/equipes pertencem ao outro stream). Envelope ApiResponse (R6).
 */

/** Atendente (B5 — AgentDto). */
export type AgentOptionDto = {
  userId: number
  nome: string
  equipeNome: string | null
  papel: string
}

/** Categoria de atendimento (B4 — ServiceCategoryDto). */
export type ServiceCategoryOptionDto = {
  id: number
  nome: string
  isActive: boolean
  /**
   * 133 — quando `true`, o backend força `billableOutsidePlan = true` em toda escrita de
   * apontamento com esta categoria (R-133), e o painel trava a caixa no `TimeEntryModal`.
   *
   * **OPCIONAL de propósito:** um backend anterior à 133 não envia a chave, e *ausente* ≠
   * *`false` declarado pelo servidor* (`AP-FRONTEND-021`). Entre dois deploys o cliente
   * novo conversa com o backend velho; a direção segura do default é **ausente → não
   * trava** (e o backend velho também não força, então nada fica incoerente).
   *
   * Nunca ler esta propriedade solta: use `forcaCobrancaForaDoPlano`, o mesmo helper da
   * tela de categorias (`features/service-categories/types/serviceCategory.ts`), que trata
   * `undefined`, `null` e objeto nulo com `=== true`.
   */
  forcesBillableOutsidePlan?: boolean
}

export async function listAgentOptions(): Promise<AgentOptionDto[]> {
  const { data } = await api.get<ApiResponse<AgentOptionDto[]>>(
    '/api/v1/teams/members',
  )
  return data.data
}

/** Apenas categorias ativas (default do endpoint — includeInactive=false). */
export async function listActiveCategoryOptions(): Promise<ServiceCategoryOptionDto[]> {
  const { data } = await api.get<ApiResponse<ServiceCategoryOptionDto[]>>(
    '/api/v1/service-categories',
    { params: { includeInactive: false } },
  )
  return data.data
}
