import { api } from '../../../services/api'
import type { ApiResponse } from '../../../types/api'

/**
 * Opções para os combos do TimeEntryModal (atendente e categorização).
 * Serviços dedicados ao modal para não acoplar à feature de telas isoladas
 * (categorias/equipes pertencem ao outro stream). Envelope ApiResponse (R6).
 */

/** Atendente (B5 — AgentDto). */
export type AgentOptionDto = {
  userId: string
  nome: string
  equipeNome: string | null
  papel: string
}

/** Categoria de atendimento (B4 — ServiceCategoryDto). */
export type ServiceCategoryOptionDto = {
  id: string
  nome: string
  isActive: boolean
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
