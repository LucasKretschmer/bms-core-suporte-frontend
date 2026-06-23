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

export type TicketReportItemDto = {
  ticketId: number
  hubspotTicketId: string
  assunto: string | null
  clienteNome: string | null
  equipe: string | null
  ownerNome: string | null
  status: string | null
  totalSeconds: number
  apontamentosCount: number
  hubspotUrl: string | null
}

// ── U5 — Relatório do Cliente ────────────────────────────────────────────────

/** Tipo de faturamento — conjunto fixo vindo do backend */
export type FaturamentoStatus = 'Plano de Suporte' | 'Faturado' | 'Não faturado'

export type ClientReportItemDto = {
  timeEntryId: number
  ticketId: number
  hubspotTicketId: string
  assunto: string | null
  equipeAtribuida: string | null
  solicitante: RequesterDto | null
  atendente: string
  categorizacaoAtendimento: string | null
  faturamento: FaturamentoStatus
  aberturaDosChamado: string  // ISO Z
  dataApontamento: string     // ISO Z
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
