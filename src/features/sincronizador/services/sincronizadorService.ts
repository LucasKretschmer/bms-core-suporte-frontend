import { api } from '../../../services/api'
import type { PaginatedResponse } from '../../../types/api'
import type {
  SincronizadorStatusDto,
  LogDto,
  ListLogsParams,
  RunResultDto,
  SyncTeamsResultDto,
  RegistroDto,
  BuscaRegistrosParams,
  TicketManutencaoDto,
  ProjetoManutencaoDto,
  RegistroTipo,
} from '../types/sincronizador'

/**
 * Monta os parâmetros de busca de manutenção a partir do termo digitado.
 * Termo só com dígitos → `hubspotId` (match exato). Caso contrário → `search`.
 * Backend exige ao menos um deles (422 SEARCH_REQUIRED), por isso a query
 * nunca deve ser disparada com termo vazio.
 */
export function buildBuscaParams(termo: string): BuscaRegistrosParams {
  const trimmed = termo.trim()
  if (/^\d+$/.test(trimmed)) {
    return { hubspotId: trimmed }
  }
  return { search: trimmed }
}

/** GET /api/v1/sincronizador/status → { data: SincronizadorStatusDto } (envelope). */
export async function getSincronizadorStatus(): Promise<SincronizadorStatusDto> {
  const { data } = await api.get<{ data: SincronizadorStatusDto }>(
    '/api/v1/sincronizador/status',
  )
  return data.data
}

/** GET /api/v1/sincronizador/logs → PaginatedResponse<LogDto> (sem envelope data). */
export async function listSincronizacaoLogs(
  params: ListLogsParams,
): Promise<PaginatedResponse<LogDto>> {
  const queryParams: Record<string, string | number> = {
    page: params.page,
    pageSize: params.pageSize,
  }
  if (params.status) queryParams.status = params.status
  if (params.sortBy) queryParams.sortBy = params.sortBy
  if (params.sortDirection) queryParams.sortDirection = params.sortDirection

  const { data } = await api.get<PaginatedResponse<LogDto>>(
    '/api/v1/sincronizador/logs',
    { params: queryParams },
  )
  return data
}

/** POST /api/v1/sincronizador/run → 202 { data: { logId } } | 409 SINCRONIZADOR_OCUPADO. */
export async function runSincronizador(): Promise<RunResultDto> {
  const { data } = await api.post<{ data: RunResultDto }>(
    '/api/v1/sincronizador/run',
  )
  return data.data
}

/** POST /api/v1/admin/sync/owners → { data: SyncTeamsResultDto, message } (envelope). */
export async function syncTeams(): Promise<SyncTeamsResultDto> {
  const { data } = await api.post<{ data: SyncTeamsResultDto }>(
    '/api/v1/admin/sync/owners',
  )
  return data.data
}

/**
 * GET /api/v1/sincronizador/registros/tickets → PaginatedResponse<TicketManutencaoDto>.
 * Mapeia para RegistroDto unificado com tipo='ticket'.
 */
export async function listRegistrosTickets(
  params: BuscaRegistrosParams,
): Promise<RegistroDto[]> {
  const { data } = await api.get<PaginatedResponse<TicketManutencaoDto>>(
    '/api/v1/sincronizador/registros/tickets',
    { params },
  )
  return data.items.map((t) => ({
    tipo: 'ticket' as const,
    hubspotId: t.hubspotId,
    assunto: t.assunto ?? '—',
    pipeline: t.pipeline,
    criadoEm: t.criadoEm,
  }))
}

/**
 * GET /api/v1/sincronizador/registros/projetos → PaginatedResponse<ProjetoManutencaoDto>.
 * Mapeia para RegistroDto unificado com tipo='projeto' e nome → assunto.
 */
export async function listRegistrosProjetos(
  params: BuscaRegistrosParams,
): Promise<RegistroDto[]> {
  const { data } = await api.get<PaginatedResponse<ProjetoManutencaoDto>>(
    '/api/v1/sincronizador/registros/projetos',
    { params },
  )
  return data.items.map((p) => ({
    tipo: 'projeto' as const,
    hubspotId: p.hubspotId,
    assunto: p.nome ?? '—',
    pipeline: p.pipeline,
    criadoEm: p.criadoEm,
  }))
}

/** Combina tickets + projetos em uma única chamada paralela. */
export async function listRegistros(
  params: BuscaRegistrosParams,
): Promise<RegistroDto[]> {
  const [tickets, projetos] = await Promise.all([
    listRegistrosTickets(params),
    listRegistrosProjetos(params),
  ])
  return [...tickets, ...projetos]
}

/** DELETE /api/v1/sincronizador/registros/tickets/{hubspotId} → 204 (idempotente). */
export async function deleteRegistroTicket(hubspotId: string): Promise<void> {
  await api.delete(`/api/v1/sincronizador/registros/tickets/${hubspotId}`)
}

/** DELETE /api/v1/sincronizador/registros/projetos/{hubspotId} → 204 (idempotente). */
export async function deleteRegistroProjeto(hubspotId: string): Promise<void> {
  await api.delete(`/api/v1/sincronizador/registros/projetos/${hubspotId}`)
}

/** DELETE genérico por tipo. */
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
