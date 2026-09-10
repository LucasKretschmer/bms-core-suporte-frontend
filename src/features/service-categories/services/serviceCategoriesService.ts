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
 * - PUT    /api/v1/service-categories/{id}              → ApiResponse<ServiceCategoryDto>  (nome + flag 133)
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

/**
 * Cria a categoria (POST). A flag vai SEMPRE explícita — ver o aviso em
 * `updateServiceCategory`.
 */
export async function createServiceCategory(
  nome: string,
  forcesBillableOutsidePlan: boolean,
): Promise<ServiceCategoryDto> {
  const { data } = await api.post<ApiResponse<ServiceCategoryDto>>(BASE, {
    nome,
    forcesBillableOutsidePlan,
  })
  return data.data
}

/**
 * Edita a categoria (PUT — nome + flag de cobrança obrigatória fora do plano).
 *
 * ⚠️ **A flag vai SEMPRE explícita, inclusive quando `false`.** O servidor declara
 * `forcesBillableOutsidePlan` como `bool?` com "null/ausente = NÃO ALTERAR"
 * (`arquitetura.md` §6.1) — isso é **rede de proteção do servidor** contra clientes que
 * omitem o campo, **não licença para o painel omitir**. Em particular, é PROIBIDO montar
 * o corpo com spread condicional (`...(forca && { forcesBillableOutsidePlan: forca })`):
 * no caso `false` o campo sumiria e o servidor entenderia "não alterar", deixando a flag
 * ligada em silêncio. Travado por teste (`serviceCategoriesService.test.ts`, caso
 * "presente e `false`").
 */
export async function updateServiceCategory(
  id: number,
  nome: string,
  forcesBillableOutsidePlan: boolean,
): Promise<ServiceCategoryDto> {
  const { data } = await api.put<ApiResponse<ServiceCategoryDto>>(`${BASE}/${id}`, {
    nome,
    forcesBillableOutsidePlan,
  })
  return data.data
}

/**
 * Alterna a ativação da categoria (PATCH — seta/limpa DesativadoEm no backend).
 * Contrato congelado: PATCH /service-categories/{id} body { isActive }.
 */
export async function toggleServiceCategory(
  id: number,
  isActive: boolean,
): Promise<ServiceCategoryDto> {
  const { data } = await api.patch<ApiResponse<ServiceCategoryDto>>(`${BASE}/${id}`, {
    isActive,
  })
  return data.data
}

export async function deleteServiceCategory(id: number): Promise<void> {
  await api.delete(`${BASE}/${id}`)
}
