import { api } from '../../../services/api'
import type { ApiResponse } from '../../../types/api'
import type { BusinessRuleDto, RuleValue } from '../types/businessRule'

/**
 * Serviço de regras de negócio (BusinessRulesController — já existe).
 * Desempacotamento do envelope ApiResponse feito aqui.
 *
 * Contrato:
 * - GET    /api/v1/business-rules            → globais (teamId == null)
 * - GET    /api/v1/business-rules?teamId=X   → regras da equipe X (apenas overrides da equipe)
 * - POST   /api/v1/business-rules            → { teamId, chave, valor }  (cria regra)
 * - PUT    /api/v1/business-rules/{id}       → { valor }                 (atualiza valor)
 *
 * `valor` é JSON arbitrário (bool | string | number). O backend desserializa para JsonElement;
 * aqui mantemos o tipo da união RuleValue.
 */

const BASE = '/api/v1/business-rules'

export async function listBusinessRules(teamId?: number | null): Promise<BusinessRuleDto[]> {
  const params = teamId != null ? { teamId } : undefined
  const { data } = await api.get<ApiResponse<BusinessRuleDto[]>>(BASE, { params })
  return data.data
}

export async function createBusinessRule(body: {
  teamId: number | null
  chave: string
  valor: RuleValue
}): Promise<BusinessRuleDto> {
  const { data } = await api.post<ApiResponse<BusinessRuleDto>>(BASE, body)
  return data.data
}

export async function updateBusinessRule(
  id: number,
  valor: RuleValue,
): Promise<BusinessRuleDto> {
  const { data } = await api.put<ApiResponse<BusinessRuleDto>>(`${BASE}/${id}`, { valor })
  return data.data
}

/**
 * Persiste uma regra: PUT se já existe (ruleId), POST se ainda não existe.
 * Centraliza a lógica "upsert por chave" para os hooks de mutation.
 */
export async function saveBusinessRule(args: {
  ruleId: number | null
  teamId: number | null
  chave: string
  valor: RuleValue
}): Promise<BusinessRuleDto> {
  if (args.ruleId) {
    return updateBusinessRule(args.ruleId, args.valor)
  }
  return createBusinessRule({ teamId: args.teamId, chave: args.chave, valor: args.valor })
}
