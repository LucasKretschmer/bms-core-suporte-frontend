import { api } from '../../../services/api'
import type { ApiResponse } from '../../../types/api'
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
