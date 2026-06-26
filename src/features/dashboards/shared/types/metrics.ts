/**
 * DTOs espelhando o backend. Nunca usar 'any'.
 * Campos nullable: null quando dado não disponível (CSAT, FCR, SLA dependem de config HubSpot).
 * tempoMedioPausaSegundos: adendo backend (Item 1 do analise-backend-adendo.md).
 */

// ── Filtros comuns ───────────────────────────────────────────────────────────

export type MetricsScope =
  | 'global'
  | `team:${string}`
  | 'management:suporte'
  | 'management:onboarding'

export type MetricsBaseParams = {
  scope?: MetricsScope
  from?: string | null   // ISO date YYYY-MM-DD
  to?: string | null
  clientId?: string | null
  supportPlanId?: string | null
}

// ── TeamDto atualizado (adendo Item 3) ───────────────────────────────────────

export type TeamDto = {
  id: number
  nome: string
  gerencia: string | null  // 'suporte' | 'onboarding' | null (não classificada)
}

// ── GET /metrics/overview ────────────────────────────────────────────────────

export type MetricsOverviewDto = {
  tempoTotalSegundos: number
  ahtSegundos: number | null
  tempoMedioPausaSegundos: number | null  // adendo Item 1
  mediaPausasPorAtendimento: number | null
  backlog: number
  ticketsAbertos: number
  ticketsAbertosVariacaoPercent: number | null
  ticketsResolvidos: number
  ticketsResolvidosVariacaoPercent: number | null
  taxaResolucao: number | null
  tmrHorasCorridas: number | null
  tmrHorasUteis: number | null
  tmeHorasCorridas: number | null
  tmeHorasUteis: number | null
  respondidosNoPrazo: number | null
  respondidosForaDoPrazo: number | null
  ticketsReabertos: number | null
  csat: number | null
  fcr: number | null
  horasPlantao: number
  horasPlano: number
  horasFaturadoPorFora: number
  horasAnalise: number
}

// ── GET /metrics/daily ───────────────────────────────────────────────────────

export type DailyDataPointDto = {
  data: string   // YYYY-MM-DD
  novos: number
  emAndamento: number
  resolvidos: number
  cancelados: number
  emAberto: number
}

export type MetricsDailyDto = {
  days: DailyDataPointDto[]
}

// ── GET /metrics/status-distribution ────────────────────────────────────────

/**
 * Um status de pipeline AGRUPADO com sua contagem somada (020). `status` = label
 * legível resolvido pelo backend (via pipelinestages). `statusKey` = chave de grupo
 * (Nome normalizado) — identidade do item (key React, cor) e param do drill por grupo.
 *
 * `stageId` permanece no contrato por RETROCOMPAT (carrega a mesma chave do grupo),
 * mas o FE usa `statusKey` como identidade/drill — não tratar como stageId único (020/D2).
 *
 * #2: se o BE não casar o label, `status` vem com o stageId cru — o FE renderiza assim.
 */
export type StatusDistributionItemDto = {
  /** @deprecated 020: usar `statusKey`. Mantido por retrocompat (carrega a chave do grupo). */
  stageId: string
  statusKey: string
  status: string
  count: number
}

/** Escopo de equipe (`byTeam: false`): lista de status. */
export type StatusDistributionTeamScopeDto = {
  byTeam: false
  data: StatusDistributionItemDto[]
}

/** Quebra de status de uma equipe (linha da matriz equipe × status). */
export type TeamStatusDistributionDto = {
  equipe: string  // "Sem equipe" para tickets sem PrimaryTeamId (decisão BE)
  porStatus: StatusDistributionItemDto[]
}

/** Escopo global (`byTeam: true`): cada equipe com sua quebra por status. */
export type StatusDistributionGlobalScopeDto = {
  byTeam: true
  data: TeamStatusDistributionDto[]
}

/**
 * União discriminada por `byTeam`. O corpo HTTP inteiro (`{ byTeam, data }`) — o
 * serviço NÃO desempacota `.data` (byTeam vem no mesmo nível de data, contrato §6).
 */
export type StatusDistributionDto =
  | StatusDistributionTeamScopeDto
  | StatusDistributionGlobalScopeDto

// ── GET /metrics/by-category ─────────────────────────────────────────────────

export type CategoryMetricDto = {
  categoria: string
  count: number
  totalSegundos: number
}

export type ByCategoryDto = {
  data: CategoryMetricDto[]
}

// ── GET /metrics/plan-health ─────────────────────────────────────────────────

export type PlanHealthItemDto = {
  clientId: number
  nomeCliente: string | null
  nomePlano: string | null
  percentualConsumo: number
  horasPlano: number
  horasUsadas: number
  faixaSaude: 'verde' | 'amarelo' | 'vermelho'
}

export type PlanHealthSummaryDto = {
  totalVerde: number
  totalAmarelo: number
  totalVermelho: number
}

export type PlanHealthResponseDto = {
  data: PlanHealthItemDto[]
  summary: PlanHealthSummaryDto
}

// ── GET /metrics/by-agent ─────────────────────────────────────────────────────

export type AgentMetricsDtoItem = {
  userId: number
  nome: string
  equipe: string | null
  nAtendimentos: number
  totalSegundos: number
  ahtSegundos: number | null
}

export type ByAgentDto = {
  data: AgentMetricsDtoItem[]
}

// ── GET /metrics/onboarding (adendo Item 2) ──────────────────────────────────

export type OnboardingProjectStatsDto = {
  iniciados: number
  emExecucao: number
  parados: number
  emFechamento: number
  concluidos: number
  cancelados: number
  pocIniciadas: number
  treinamentos: number
  totalAtivos: number
}

export type OnboardingAgentTicketDto = {
  userId: number
  nome: string
  equipe: string | null
  nAtendimentos: number
  totalSegundos: number
}

export type OnboardingTicketStatsDto = {
  emAberto: number
  resolvidos: number
  porAtendente: OnboardingAgentTicketDto[]
}

export type OnboardingNpsPlaceholderDto = {
  npsScore: number | null
  totalRespondentes: number | null
  promotores: number | null
  passivos: number | null
  detratores: number | null
  observacao: string
}

export type OnboardingMetricsDto = {
  projetos: OnboardingProjectStatsDto
  tickets: OnboardingTicketStatsDto
  nps: OnboardingNpsPlaceholderDto
}

// ── Drill-down rows (overview?format=rows) ───────────────────────────────────

export type TimeEntryRowDto = {
  timeEntryId: number
  ticketId: number
  hubspotTicketId: string
  assunto: string | null
  atendente: string
  equipe: string | null
  totalSegundos: number
  dataApontamento: string
}

// ── Drill-down paramétrico (016 — GET /metrics/rows?metric=) ─────────────────

/**
 * Linha da família TICKET (espelha TicketRowDto do backend).
 * `ticketId` é o id INTERNO usado para navegar à tela de detalhe — NUNCA o HubSpot id.
 * `status` é o label resolvido via pipelinestages — NUNCA a categoria HubSpot (AP-SECURITY-001).
 */
export type TicketRowDto = {
  ticketId: number
  hubspotTicketId: string
  assunto: string | null
  clienteNome: string | null
  equipe: string | null
  ownerNome: string | null
  status: string | null
  hsCriadoEm: string | null
  fechadoEm: string | null
  reabertoEm: string | null
  frHoras: number | null
  frHorasUteis: number | null
  frSla: string | null
  resHoras: number | null
  resHorasUteis: number | null
  csat: number | null
  isOneTouch: boolean | null
  hubspotUrl: string | null
}

/**
 * Métricas da família TICKET disponíveis no backend (1ª onda da 016, já em main).
 * Apontamento/Cliente/Projeto ainda retornam 422 no backend (ondas B1/B3/B4) — fora do
 * union até existirem (drill desses indicadores fica como TODO no frontend).
 */
export type TicketMetricKey =
  | 'tickets-backlog'
  | 'tickets-abertos'
  | 'tickets-resolvidos'
  | 'tickets-reabertos'
  | 'tickets-tempos'
  | 'tickets-sla'
  | 'tickets-csat'
  | 'tickets-fcr'

/** Parâmetros específicos por metric (todos opcionais; validados no backend). */
export type DrillParams = {
  /**
   * tickets-backlog (020) — chave de status agrupado. O backend resolve os stageIds
   * membros do grupo (A01 — nunca aceita lista de stageIds do FE). Caminho oficial.
   */
  statusKey?: string
  /** @deprecated tickets-backlog: stageId único. Use `statusKey` (tem precedência no BE). */
  stageId?: string
  /** tickets-sla — 'on' (no prazo / MET) | 'late' (fora / MISSED). Obrigatório para tickets-sla. */
  sla?: 'on' | 'late'
}

/**
 * Especificação de um drill-down: qual conjunto de registros abrir.
 * Mapeia 1:1 com o `dDrill`/`dDrillChart` do protótipo.
 */
export type DrillSpec = {
  metric: TicketMetricKey
  /** Título seguro do modal (sem categoria HubSpot). */
  title: string
  params?: DrillParams
}

/** Parâmetros enviados a GET /metrics/rows (família ticket). */
export type MetricRowsParams = {
  metric: TicketMetricKey
  scope?: MetricsScope
  from?: string | null
  to?: string | null
  clientId?: string | null
  stageId?: string | null
  /** tickets-backlog (020): chave de status agrupado. Precedência sobre `stageId` no BE. */
  statusKey?: string | null
  sla?: 'on' | 'late' | null
  sortBy?: string | null
  sortDirection?: 'asc' | 'desc'
  page: number
  pageSize: number
}

// ── SSE eventos ──────────────────────────────────────────────────────────────

export type MetricsStreamEventType =
  | 'TIME_ENTRY_SAVED'
  | 'TIME_ENTRY_UPDATED'
  | 'TICKET_STATUS_CHANGED'
  | 'TICKET_CREATED'
  | 'keepalive'
