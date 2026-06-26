import { api } from '../../../services/api'
import type { ApiResponse } from '../../../types/api'
import type { RoleCode } from '../types/agentRole'
import type { AgentDto } from '../types/team'

/**
 * Serviço de atendentes (B5).
 * GET /api/v1/teams/members → ApiResponse<AgentDto[]> — desempacota .data aqui.
 *
 * A lista de equipes (cabeçalho dos cards) reusa reportsService.listTeams() — não duplicar.
 */
export async function listAgents(): Promise<AgentDto[]> {
  const { data } = await api.get<ApiResponse<AgentDto[]>>('/api/v1/teams/members')
  return data.data
}

/**
 * Atualiza o papel (role) de um atendente (demanda 012 — #13).
 * PATCH /api/v1/users/{id}/role  body: { role: <short> } → ApiResponse<AgentDto>
 *
 * `role` é o código numérico do enum Role do backend (1=Atendente … 3=Gerente).
 * Anti-mass-assignment: envia APENAS o campo papel; o id vai na rota.
 * O backend é a fonte de verdade — valida policy (GerentePlus) e o valor do enum.
 */
export async function updateAgentRole(userId: number, role: RoleCode): Promise<AgentDto> {
  const { data } = await api.patch<ApiResponse<AgentDto>>(`/api/v1/users/${userId}/role`, { role })
  return data.data
}
