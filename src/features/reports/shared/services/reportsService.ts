import { api } from '../../../../services/api'
import type { ApiResponse, PaginatedResponse } from '../../../../types/api'
import type {
  AgentMetricDto,
  ClientListItemDto,
  ClientReportDto,
  PlanConsumptionItemDto,
  SupportPlanDto,
  TeamDto,
  TicketReportItemDto,
} from '../types/reports'

/**
 * Serviços de relatórios.
 * Desempacotamento do envelope feito aqui — nunca nos componentes.
 * Tipagem explícita de todos os parâmetros e retornos.
 */

// ── U3 — Consumo de Planos ───────────────────────────────────────────────────

type PlanConsumptionParams = {
  search?: string
  planId?: string | null
  from?: string | null
  to?: string | null
  sortBy?: string | null
  sortDirection?: 'asc' | 'desc'
  page: number
  pageSize: number
}

export async function listPlanConsumption(
  params: PlanConsumptionParams,
): Promise<PaginatedResponse<PlanConsumptionItemDto>> {
  const { data } = await api.get<PaginatedResponse<PlanConsumptionItemDto>>(
    '/api/v1/metrics/plan-consumption',
    { params: cleanParams(params) },
  )
  return data
}

// ── U4 — Apontamentos por Ticket ─────────────────────────────────────────────

type TicketsReportParams = {
  scope?: 'mine' | 'team' | 'all'
  search?: string
  status?: string[]
  from?: string | null
  to?: string | null
  sortBy?: string | null
  sortDirection?: 'asc' | 'desc'
  page: number
  pageSize: number
}

export async function listTicketsReport(
  params: TicketsReportParams,
): Promise<PaginatedResponse<TicketReportItemDto>> {
  const { data } = await api.get<PaginatedResponse<TicketReportItemDto>>(
    '/api/v1/reports/tickets',
    { params: cleanParams(params) },
  )
  return data
}

// ── U5 — Relatório do Cliente ────────────────────────────────────────────────

type ClientReportParams = {
  clientId: string
  month: string           // YYYY-MM
  format?: 'rows' | 'summary'
  sortBy?: string | null
  sortDirection?: 'asc' | 'desc'
  page: number
  pageSize: number
}

export async function getClientReport(
  params: ClientReportParams,
): Promise<ClientReportDto> {
  const { data } = await api.get<ClientReportDto>(
    '/api/v1/reports/client',
    { params: cleanParams(params) },
  )
  return data
}

// ── U6 — Produtividade ───────────────────────────────────────────────────────

type ProductivityParams = {
  from?: string | null
  to?: string | null
  teamId?: string | null
  page: number
  pageSize: number
}

export async function listProductivity(
  params: ProductivityParams,
): Promise<PaginatedResponse<AgentMetricDto>> {
  const { data } = await api.get<PaginatedResponse<AgentMetricDto>>(
    '/api/v1/reports/productivity',
    { params: cleanParams(params) },
  )
  return data
}

// ── Auxiliares (comboboxes) ───────────────────────────────────────────────────

type ClientsParams = {
  search?: string
  page: number
  pageSize: number
}

export async function listClients(
  params: ClientsParams,
): Promise<PaginatedResponse<ClientListItemDto>> {
  const { data } = await api.get<PaginatedResponse<ClientListItemDto>>(
    '/api/v1/clients',
    { params: cleanParams(params) },
  )
  return data
}

export async function listTeams(): Promise<TeamDto[]> {
  const { data } = await api.get<ApiResponse<TeamDto[]>>('/api/v1/teams')
  return data.data
}

export async function listSupportPlans(): Promise<SupportPlanDto[]> {
  // Response: envelope ApiResponse<SupportPlanDto[]> (igual /teams) — desempacotar .data
  const { data } = await api.get<ApiResponse<SupportPlanDto[]>>('/api/v1/support-plans')
  return data.data
}

// ── Utilitário: remove null/undefined dos params ──────────────────────────────

function cleanParams(params: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== null && v !== undefined && v !== ''),
  )
}
