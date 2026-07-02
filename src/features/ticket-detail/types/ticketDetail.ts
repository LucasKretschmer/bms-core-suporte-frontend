/**
 * Tipos do detalhe do ticket (F3/F4) — mapeados dos DTOs reais do backend (R6).
 *
 * - Header: GET /api/v1/tickets/by-id/{ticketId} → ApiResponse<TicketResponseDto> (B8)
 * - Apontamentos: GET /api/v1/tickets/{ticketId}/time-entries
 *     → ApiResponse<TicketTimeEntryDto[]> (B2/B3)
 *
 * Nomes/shape confirmados em analise-backend.md (B2/B3/B8). Nunca usar `any`.
 */

/** Segmento WORK/PAUSE de um apontamento (TimeLogResponseDto reutilizado pelo backend). */
export type TicketSegmentDto = {
  id: number
  type: 'WORK' | 'PAUSE'
  segmentStart: string // ISO Z
  segmentEnd: string // ISO Z
}

/** Apontamento do ticket com nome de agente e categoria (B2/B3 — TicketTimeEntryDto). */
export type TicketTimeEntryDto = {
  id: number
  userId: number
  agenteNome: string
  serviceCategoryId: number | null
  categorizacaoNome: string | null
  billableOutsidePlan: boolean
  status: string // RUNNING | PAUSED | COMPLETED | CANCELLED
  startTime: string // ISO Z
  endTime: string | null // ISO Z
  totalSeconds: number
  note: string | null
  pendingCategory: boolean
  /** Quem cancelou o apontamento (099) — preenchido quando status = CANCELLED. */
  canceladoPorUserId: number | null
  canceladoPorNome: string | null
  segments: TicketSegmentDto[]
}

/** Owner/atendente do ticket (OwnerDto do backend). */
export type TicketOwnerDto = {
  userId: number
  nome: string
  hubspotOwnerId: number
}

/** Cliente resumido do ticket (ClientDto do backend). */
export type TicketClientDto = {
  id: number
  nomeFantasia: string | null
  razaoSocial: string | null
  cnpj: string | null
}

/** Solicitante / contato HubSpot do ticket (RequesterDto do backend). */
export type TicketRequesterDto = {
  nome: string | null
  email: string | null
}

/**
 * Header/meta do ticket (B8 — TicketResponseDto ANINHADO, mesmo DTO de by-hubspot-id).
 * Shape real do backend (camelCase, objetos aninhados nullable). `categoria` é a
 * categoria HubSpot (uso interno permitido aqui — R5). Não existe `status`: o status
 * exibido é `pipelineStage`. `owner`/`client`/`requester` são nullable conforme dados
 * vindos do HubSpot.
 */
export type TicketHeaderDto = {
  id: number
  hubspotTicketId: string
  assunto: string | null
  categoria: string | null
  pipelineStage: string | null
  owner: TicketOwnerDto | null
  client: TicketClientDto | null
  requester: TicketRequesterDto | null
  hubspotUrl: string | null
  conteudo: string | null
  hsCriadoEm: string | null // ISO Z
}
