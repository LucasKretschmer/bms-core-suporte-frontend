/**
 * Tipos dos DTOs de relatórios — mapeados exatamente do backend.
 * Nunca usar 'any'. Nunca duplicar tipos do backend.
 */

// ── Comuns ──────────────────────────────────────────────────────────────────

export type RequesterDto = {
  nome: string | null
  email: string | null
}

// ── Configuração ─────────────────────────────────────────────────────────────

export type SupportPlanDto = {
  id: number
  nome: string
  horasMes: number
  precoHoraExtra: number | null
  moeda: string
  isActive: boolean
}

export type ClientListItemDto = {
  id: number
  hubspotCompanyId: number
  cnpj: string | null
  razaoSocial: string | null
  nomeFantasia: string | null
  planNome: string | null
}

export type ClientDetailDto = {
  id: number
  hubspotCompanyId: number
  cnpj: string | null
  razaoSocial: string | null
  nomeFantasia: string | null
  supportPlan: SupportPlanDto | null
  horasOverride: number | null
  horasEfetivas: number | null
}

export type TeamDto = {
  id: number
  nome: string
  /** Derivado de appsettings no backend; null p/ equipes sincronizadas. */
  gerencia: string | null
}

// ── U3 — Consumo de Planos ───────────────────────────────────────────────────

export type PlanConsumptionItemDto = {
  clientId: number
  cnpj: string | null
  nomeFantasia: string | null
  razaoSocial: string | null
  nomePlano: string | null
  qtdePlanoHoras: number
  horasUsadas: number
  horasRestantes: number
  horasAdicionais: number
  percentualPlano: number | null
  horasFaturaveis: number
  horasAnalise: number
}

// ── U4 — Apontamentos por Ticket ─────────────────────────────────────────────

/**
 * Categoria semântica fechada do stage (whitelist do banco, 4 valores + null).
 * MELH-01 — fonte da cor do badge de Status. NUNCA derivar cor a partir do
 * texto de `status` (label livre vindo do HubSpot).
 */
export type TicketStatusCategoria = 'aberto' | 'emandamento' | 'fechado' | 'cancelado'

export type TicketReportItemDto = {
  ticketId: number
  hubspotTicketId: string
  assunto: string | null
  clienteNome: string | null
  equipe: string | null
  ownerNome: string | null
  status: string | null
  /**
   * Categoria do HubSpot (ex.: "Problema - Invoicy"). Exibida apenas na TELA
   * (coluna + filtro) desta tela interna — NUNCA no export CSV/Excel (privacidade,
   * AP-SECURITY-001/§8.3). Null quando o backend não classifica o ticket.
   */
  categoria?: string | null
  totalSeconds: number
  apontamentosCount: number
  hubspotUrl: string | null

  // ── NOVOS (aditivos, 119 — CORR-05/MELH-01/MELH-02) — sempre presentes ──────
  /**
   * CORR-05 — regra canônica: `DesativadoEm IS NULL` + `Status NOT IN (Cancelled,
   * Discarded)` (120/D-1 amplia a exclusão para incluir Discarded), SEM recorte de
   * período (distinto de `totalSeconds`, que é do período filtrado).
   */
  totalSecondsAllTime: number
  /** CORR-05 — idem, contagem de apontamentos sem recorte de período. */
  apontamentosCountAllTime: number
  /** MELH-01 — nome cru do stage, sem "(Pipeline)". Não usado nesta entrega (o texto do badge vem de `status`); mantido por paridade de contrato. */
  statusNome: string | null
  /** MELH-01 — fonte da cor do badge de Status. NUNCA derivar cor de `status` (texto). */
  statusCategoria: TicketStatusCategoria | null
  /** MELH-02 — nomes distintos das categorias do TIMER nos apontamentos da mesma janela de `totalSeconds` (período + Completed). Vazio = nenhum apontamento categorizado no período. */
  categoriasTimer: string[]
}

/** MELH-02 — opção do filtro "Categoria do atendimento" (categoria do TIMER, interna). */
export type ServiceCategoryOptionDto = {
  id: number
  nome: string
  isActive: boolean
}

// ── Origem de apontamento (057) ───────────────────────────────────────────────

/**
 * Origem de um apontamento na visão por cliente combinada (057).
 * Discrimina linhas de ticket e de projeto na mesma listagem.
 */
export type OrigemApontamento = 'ticket' | 'projeto'

/**
 * Filtro de origem na visão por cliente combinada (057).
 * 'all' = todos (ticket + projeto); default no backend.
 */
export type OrigemFiltro = 'all' | 'ticket' | 'projeto'

// ── 057 — Apontamentos por Projeto ────────────────────────────────────────────

/**
 * Item do relatório de apontamentos por PROJETO (057).
 * Espelha o de tickets, mas project-centric: sem hubspotTicketId nem categoria HubSpot.
 * faturamento: "Faturado" | "Plano de Suporte" (projeto não tem categoria Invoicy).
 */
export type ProjectAppointmentReportItemDto = {
  timeEntryId: number
  projetoId: number
  projetoNome: string | null
  stage: string | null
  clienteNome: string | null
  equipeAtribuida: string | null
  atendente: string
  categorizacaoAtendimento: string | null
  faturamento: FaturamentoStatus
  dataApontamento: string     // ISO Z
  totalSegundos: number
}

// ── U5 — Relatório do Cliente ────────────────────────────────────────────────

/** Tipo de faturamento — conjunto fixo vindo do backend */
export type FaturamentoStatus = 'Plano de Suporte' | 'Faturado' | 'Não faturado'

/**
 * Item individual do relatório do cliente (visão combinada 057).
 * Cada linha é um apontamento de TICKET ou de PROJETO (discriminado por `origem`).
 *
 * Campos ticket-only (`ticketId`, `hubspotTicketId`, `assunto`, `aberturaDosChamado`)
 * são null quando origem = 'projeto'. Campos de projeto (`projetoId`, `projetoNome`,
 * `stage`) são null quando origem = 'ticket'.
 */
export type ClientReportItemDto = {
  timeEntryId: number
  origem: OrigemApontamento
  ticketId: number | null
  hubspotTicketId: string | null
  projetoId: number | null
  projetoNome: string | null
  stage: string | null
  assunto: string | null
  equipeAtribuida: string | null
  solicitante: RequesterDto | null
  atendente: string
  /**
   * Dono/responsável do chamado (owner do ticket) — DISTINTO do `atendente` do
   * apontamento. Vem do backend (096) como chave JSON `donoChamado` (camelCase).
   * Null para origem = 'projeto' (projeto pode não ter owner) ou quando o backend
   * local ainda não expõe o campo — nesse caso o consolidado degrada para o
   * fallback de atendentes distintos.
   */
  donoChamado?: string | null
  categorizacaoAtendimento: string | null
  /** Propriedade HubSpot 'servico' (118.5.2) — serviço vinculado ao chamado. */
  servico: string | null
  /** Propriedade HubSpot 'servico__secundario' (118.5.2). */
  servicoSecundario: string | null
  faturamento: FaturamentoStatus
  aberturaDosChamado: string | null  // ISO Z (null p/ projeto)
  dataApontamento: string            // ISO Z
  totalSegundos: number
}

export type ClientReportDto = {
  client: ClientDetailDto
  plano: SupportPlanDto | null
  competencia: string         // YYYY-MM
  totalApontamentos: number
  totalSegundos: number
  horasPlanoSegundos: number
  horasFaturadoSegundos: number
  horasNaoFaturadoSegundos: number
  items: ClientReportItemDto[] | null
}

// ── U6 — Produtividade por Analista ─────────────────────────────────────────

export type AgentMetricDto = {
  userId: number
  nome: string
  equipe: string | null
  nAtendimentos: number
  totalSegundos: number
  ahtSegundos: number | null
  mediaPausas: number | null
}
