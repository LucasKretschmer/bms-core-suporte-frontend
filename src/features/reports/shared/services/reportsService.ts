import { api } from '../../../../services/api'
import type { ApiResponse, PaginatedResponse } from '../../../../types/api'
import type {
  AgentMetricDto,
  ClientListItemDto,
  ClientReportDto,
  OrigemFiltro,
  PlanConsumptionResponseDto,
  ProjectAppointmentReportItemDto,
  ServiceCategoryOptionDto,
  SupportPlanDto,
  TeamDto,
  TicketReportItemDto,
  TicketStatusCategoria,
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

  /**
   * 135/G5 — filtro "Uso do plano". Nome do parâmetro de query: **`usoPlano`**
   * (`MetricsController.cs:446`; a rota também aceita a grafia `usoPlano[]` em `:447`,
   * e a que este cliente emite é a **sem** colchetes).
   *
   * 🔴 **`string[]`, nunca a união literal `FaixaUsoDoPlano[]`** (AP-API-002, mesmo
   * desenho de `fonte?: string | null` no envelope): o vocabulário é do **servidor**, e
   * declará-lo como união aqui mentiria para o compilador sobre um valor que o transporte
   * não controla. Os tokens vivem num único lugar do front —
   * `plan-consumption/usoDoPlanoTextos.ts`.
   *
   * Serialização: `usoPlano=dentro&usoPlano=risco` (repeat, **sem** colchetes e **sem**
   * índices), pelo `paramsSerializer: { indexes: null }` de `services/api.ts:40` — é a
   * grafia que o model binding do ASP.NET liga a `string[]`. Nada a mudar no serializer.
   *
   * 🔴 **Nada selecionado ⇒ o parâmetro NÃO SAI, e a conversão é do CALL SITE:**
   * `cleanParams` (no fim deste arquivo) descarta `null`/`undefined`/`''`, **não**
   * array vazio ⇒ `usoPlano: []` viajaria como `?usoPlano=`. O servidor tolera isso
   * como ausência (`MetricsController.cs:458-461`), mas depender da tolerância de
   * terceiro é construir sobre ela. O requisito é
   * `filters.usoPlano.length > 0 ? filters.usoPlano : undefined` em **todo** call site —
   * hook **e** export (`135/analise-frontend.md` §3.5.1).
   *
   * ⚠️ Token não vazio fora do vocabulário ⇒ **400 `INVALID_USO_PLANO`**
   * (`MetricsController.cs:467-478`), nunca "sem filtro" — logo a tela mostra
   * `ErrorState` com retry, jamais a mensagem de vazio.
   */
  usoPlano?: string[]
}

/**
 * 🔴 **132/F4d — o retorno passou a ser o ENVELOPE** (`PlanConsumptionResponseDto`), que
 * herda de `PaginatedResponse<PlanConsumptionItemDto>` e acrescenta
 * `fonte`/`competencia`/`competenciaFechadaEm`/`competenciaVersao`/`aviso*` (D12).
 *
 * Nada é desempacotado nem normalizado aqui: esta rota devolve envelope de paginação **cru**
 * (não `ApiResponse<T>`), e a normalização de `fonte` é de função pura testável
 * (`normalizarFonte`), não do transporte. O service continua sendo só transporte.
 *
 * ⚠️ Os campos do envelope **ainda não chegam** (132/B11 não entregue). O tipo os declara
 * todos opcionais e a tela trata a ausência como "não sei" — é o que faz esta unidade poder
 * subir antes do backend sem exibir nada de errado.
 */
export async function listPlanConsumption(
  params: PlanConsumptionParams,
): Promise<PlanConsumptionResponseDto> {
  const { data } = await api.get<PlanConsumptionResponseDto>(
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
  teamId?: number[]
  /** Categorias HubSpot para filtrar — enviado como categoria[] (array na query). */
  categoria?: string[]
  /**
   * MELH-02 — categorias do TIMER (internas, `TimeEntry.ServiceCategoryId`).
   * NÃO confundir com `categoria` (HubSpot). AND com os demais filtros; vazio = sem filtro.
   */
  serviceCategoryId?: number[]
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

/** Opção legível de status: value = stageId (enviado em status[]); label = texto exibido. */
export type TicketStatusOption = {
  value: string
  label: string
  /** MELH-01 — não consumido nesta entrega (a legenda é fixa, não depende das opções do filtro de Status); mantido por paridade de contrato com o backend. */
  categoria?: TicketStatusCategoria | null
}

/**
 * Opções de status (pipelineStage) para o filtro multi-select de Apontamentos.
 * Distinct scope-aware do backend, já com label legível.
 * Envelope ApiResponse<{ value; label }[]> (igual /teams).
 */
export async function getTicketStatuses(): Promise<TicketStatusOption[]> {
  const { data } = await api.get<ApiResponse<TicketStatusOption[]>>(
    '/api/v1/reports/tickets/statuses',
  )
  return data.data
}

/** Opção de categoria HubSpot: value = categoria enviada em categoria[]; label = texto exibido. */
export type TicketCategoryOption = {
  value: string
  label: string
}

/**
 * Opções de categoria (HubSpot) para o filtro multi-select de Apontamentos (107).
 * Distinct do backend, mesmo padrão/envelope de getTicketStatuses.
 * Envelope ApiResponse<{ value; label }[]>.
 */
export async function getTicketCategories(): Promise<TicketCategoryOption[]> {
  const { data } = await api.get<ApiResponse<TicketCategoryOption[]>>(
    '/api/v1/reports/tickets/categories',
  )
  return data.data
}

/**
 * Opções de "Categoria do atendimento" (MELH-02 — categoria do TIMER, interna,
 * distinta da categoria do HubSpot). Envelope `ApiResponse<T[]>` — AP-ARQUITETURA-001:
 * este endpoint NÃO é `PaginatedResponse` cru (diferente de /reports/tickets).
 */
export async function listServiceCategoryOptions(): Promise<ServiceCategoryOptionDto[]> {
  const { data } = await api.get<ApiResponse<ServiceCategoryOptionDto[]>>(
    '/api/v1/service-categories',
    { params: { includeInactive: false } },
  )
  return data.data
}

// ── 057 — Apontamentos por Projeto ────────────────────────────────────────────

type ProjectAppointmentsParams = {
  scope?: 'mine' | 'team' | 'all'
  search?: string
  teamId?: number[]
  projectId?: string | number | null
  clientId?: string | number | null
  from?: string | null
  to?: string | null
  sortBy?: string | null
  sortDirection?: 'asc' | 'desc'
  page: number
  pageSize: number
}

/**
 * Relatório de Apontamentos por Projeto (057).
 * Espelha o de tickets, mas project-centric. Envelope: PaginatedResponse direto
 * (sem `data`), igual a /reports/appointments e /reports/tickets.
 */
export async function listProjectAppointments(
  params: ProjectAppointmentsParams,
): Promise<PaginatedResponse<ProjectAppointmentReportItemDto>> {
  const { data } = await api.get<PaginatedResponse<ProjectAppointmentReportItemDto>>(
    '/api/v1/reports/project-appointments',
    { params: cleanParams(params) },
  )
  return data
}

// ── U5 — Relatório do Cliente (visão combinada ticket + projeto, 057) ─────────

type ClientReportParams = {
  clientId: string
  from: string            // YYYY-MM-DD (1º dia do intervalo)
  to: string              // YYYY-MM-DD (último dia do intervalo)
  format?: 'rows' | 'summary'
  /** 057: filtra a fonte das linhas — all (default) | ticket | projeto */
  origem?: OrigemFiltro
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
  sortBy?: string | null
  sortDirection?: 'asc' | 'desc'
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
