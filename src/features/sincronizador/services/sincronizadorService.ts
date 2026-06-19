import { api } from '../../../services/api'
import type { PaginatedResponse } from '../../../types/api'
import type {
  SincronizacaoStatusDto,
  SincronizacaoLogDto,
  ListLogsParams,
  RunResultDto,
  SyncTeamsResultDto,
  RegistroDto,
  BuscaRegistrosParams,
  RegistroTipo,
} from '../types/sincronizador'

/** GET /api/v1/sincronizador/status → { data: SincronizacaoStatusDto } */
export async function getSincronizadorStatus(): Promise<SincronizacaoStatusDto> {
  const { data } = await api.get<{ data: SincronizacaoStatusDto }>(
    '/api/v1/sincronizador/status',
  )
  return data.data
}

/** GET /api/v1/sincronizador/logs → PaginatedResponse<SincronizacaoLogDto> (sem envelope data) */
export async function listSincronizacaoLogs(
  params: ListLogsParams,
): Promise<PaginatedResponse<SincronizacaoLogDto>> {
  // Remove params undefined/null/vazio para não poluir a query string
  const queryParams: Record<string, string | number> = {
    page: params.page,
    pageSize: params.pageSize,
  }
  if (params.status) queryParams.status = params.status
  if (params.sortBy) queryParams.sortBy = params.sortBy
  if (params.sortDirection) queryParams.sortDirection = params.sortDirection

  const { data } = await api.get<PaginatedResponse<SincronizacaoLogDto>>(
    '/api/v1/sincronizador/logs',
    { params: queryParams },
  )
  return data
}

/** POST /api/v1/sincronizador/run → 202 { data: RunResultDto } | 409 SINCRONIZADOR_OCUPADO */
export async function runSincronizador(): Promise<RunResultDto> {
  const { data } = await api.post<{ data: RunResultDto }>(
    '/api/v1/sincronizador/run',
  )
  return data.data
}

/** POST /api/v1/admin/sync/owners → { data: SyncTeamsResultDto, message } */
export async function syncTeams(): Promise<SyncTeamsResultDto> {
  const { data } = await api.post<{ data: SyncTeamsResultDto }>(
    '/api/v1/admin/sync/owners',
  )
  return data.data
}

/** GET /api/v1/sincronizador/registros/tickets?busca=... → { data: RegistroDto[] } */
export async function listRegistrosTickets(
  params: BuscaRegistrosParams,
): Promise<RegistroDto[]> {
  const { data } = await api.get<{ data: RegistroDto[] }>(
    '/api/v1/sincronizador/registros/tickets',
    { params },
  )
  return data.data
}

/** GET /api/v1/sincronizador/registros/projetos?busca=... → { data: RegistroDto[] } */
export async function listRegistrosProjetos(
  params: BuscaRegistrosParams,
): Promise<RegistroDto[]> {
  const { data } = await api.get<{ data: RegistroDto[] }>(
    '/api/v1/sincronizador/registros/projetos',
    { params },
  )
  return data.data
}

/** Lista tickets + projetos combinados em uma única chamada paralela */
export async function listRegistros(
  params: BuscaRegistrosParams,
): Promise<RegistroDto[]> {
  const [tickets, projetos] = await Promise.all([
    listRegistrosTickets(params),
    listRegistrosProjetos(params),
  ])
  return [...tickets, ...projetos]
}

/** DELETE /api/v1/sincronizador/registros/tickets/{hubspotId} → 204 */
export async function deleteRegistroTicket(hubspotId: string): Promise<void> {
  await api.delete(`/api/v1/sincronizador/registros/tickets/${hubspotId}`)
}

/** DELETE /api/v1/sincronizador/registros/projetos/{hubspotId} → 204 */
export async function deleteRegistroProjeto(hubspotId: string): Promise<void> {
  await api.delete(`/api/v1/sincronizador/registros/projetos/${hubspotId}`)
}

/** DELETE genérico por tipo */
export async function deleteRegistro(
  tipo: RegistroTipo,
  hubspotId: string,
): Promise<void> {
  if (tipo === 'ticket') {
    await deleteRegistroTicket(hubspotId)
  } else {
    await deleteRegistroProjeto(hubspotId)
  }
}
