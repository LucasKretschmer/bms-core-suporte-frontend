import { api } from '../../../services/api'
import type { ApiResponse } from '../../../types/api'
import type { ServiceCategoryDto } from '../types/serviceCategory'

/**
 * Serviços de Categorias do Atendimento (B4).
 * Desempacotamento do envelope ApiResponse feito aqui — nunca nos componentes.
 *
 * Contrato (analise-backend §B4 + contrato congelado QA round 1):
 * - GET    /api/v1/service-categories?includeInactive=  → ApiResponse<ServiceCategoryDto[]>
 * - POST   /api/v1/service-categories                   → ApiResponse<ServiceCategoryDto>
 * - PUT    /api/v1/service-categories/{id}              → ApiResponse<ServiceCategoryDto>  (renomear)
 * - PATCH  /api/v1/service-categories/{id} { isActive } → ApiResponse<ServiceCategoryDto>  (toggle ativação)
 * - DELETE /api/v1/service-categories/{id}              → 204
 */

const BASE = '/api/v1/service-categories'

export async function listServiceCategories(
  includeInactive = true,
): Promise<ServiceCategoryDto[]> {
  const { data } = await api.get<ApiResponse<ServiceCategoryDto[]>>(BASE, {
    params: { includeInactive },
  })
  return data.data
}

export async function createServiceCategory(nome: string): Promise<ServiceCategoryDto> {
  const { data } = await api.post<ApiResponse<ServiceCategoryDto>>(BASE, { nome })
  return data.data
}

/** Renomeia a categoria (PUT — atualização de nome). */
export async function updateServiceCategory(
  id: string,
  nome: string,
): Promise<ServiceCategoryDto> {
  const { data } = await api.put<ApiResponse<ServiceCategoryDto>>(`${BASE}/${id}`, { nome })
  return data.data
}

/**
 * Alterna a ativação da categoria (PATCH — seta/limpa DesativadoEm no backend).
 * Contrato congelado: PATCH /service-categories/{id} body { isActive }.
 */
export async function toggleServiceCategory(
  id: string,
  isActive: boolean,
): Promise<ServiceCategoryDto> {
  const { data } = await api.patch<ApiResponse<ServiceCategoryDto>>(`${BASE}/${id}`, {
    isActive,
  })
  return data.data
}

export async function deleteServiceCategory(id: string): Promise<void> {
  await api.delete(`${BASE}/${id}`)
}
