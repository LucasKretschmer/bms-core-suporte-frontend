import { z } from 'zod'

// ── Enums de domínio ──────────────────────────────────────────────────────────
export type SyncStatus = 'executando' | 'concluido' | 'erro'
export type SyncDisparo = 'automatico' | 'manual'
export type RegistroTipo = 'ticket' | 'projeto'
/** Status agregado do sistema, calculado pelo backend (não derivar no front). */
export type StatusSistema = 'online' | 'offline' | 'degradado'

// ── DTOs ──────────────────────────────────────────────────────────────────────

/**
 * Espelha SincronizacaoLogDto / UltimaExecucaoDto do backend (camelCase).
 * Contadores são flat (não aninhados em `contadores`).
 */
export type LogDto = {
  logId: number
  status: SyncStatus
  disparo: SyncDisparo
  iniciadoEm: string
  finalizadoEm: string | null
  duracaoMs: number | null
  ticketsUpserted: number
  ticketsIgnorados: number
  projetosUpserted: number
  projetosIgnorados: number
  empresasResolvidas: number
  contatosResolvidos: number
  mensagemErro: string | null
}

/**
 * Status atual do sincronizador.
 * `statusSistema` vem calculado do backend (heurística no servidor).
 * `ultimaExecucao` reusa o shape de LogDto (contadores flat).
 */
export type SincronizadorStatusDto = {
  statusSistema: StatusSistema
  emExecucao: boolean
  intervaloMinutos: number
  ultimaExecucao: LogDto | null
}

/** Resultado do run manual (202) — backend só devolve logId. */
export type RunResultDto = {
  logId: number
}

/** Resultado da sincronização de equipes. */
export type SyncTeamsResultDto = {
  ownersProcessed: number
  teamsProcessed: number
}

/** Item de ticket vindo de /registros/tickets (camelCase). */
export type TicketManutencaoDto = {
  ticketId: number
  hubspotId: string
  assunto: string | null
  pipeline: string | null
  pipelineStage: string | null
  hsCriadoEm: string | null
  criadoEm: string
  atualizadoEm: string
}

/** Item de projeto vindo de /registros/projetos (camelCase). */
export type ProjetoManutencaoDto = {
  projetoId: number
  hubspotId: string
  nome: string | null
  tipo: string | null
  pipeline: string | null
  stage: string | null
  iniciadoEm: string | null
  concluidoEm: string | null
  criadoEm: string
  atualizadoEm: string
}

/**
 * Registro unificado client-side (tickets + projetos) para a tabela de
 * manutenção. `tipo` é injetado no front; projeto mapeia `nome → assunto`.
 * Apenas ativos chegam aqui (backend não expõe desativados, sem desativadoEm).
 */
export type RegistroDto = {
  tipo: RegistroTipo
  hubspotId: string
  assunto: string
  pipeline: string | null
  criadoEm: string
}

/** Parâmetros da listagem de logs. */
export type ListLogsParams = {
  status?: SyncStatus
  page: number
  pageSize: number
  sortBy?: 'iniciadoEm' | 'status' | 'duracaoMs'
  sortDirection?: 'asc' | 'desc'
}

/**
 * Parâmetros de busca de registros enviados ao backend.
 * Quando o termo é um ID HubSpot numérico → `hubspotId`; senão → `search`.
 * Nunca enviar ambos vazios (backend responde 422 SEARCH_REQUIRED).
 */
export type BuscaRegistrosParams = {
  search?: string
  hubspotId?: string
}

// ── Schemas Zod ───────────────────────────────────────────────────────────────

/** Valida o campo de busca de registros. */
export const buscaRegistroSchema = z.object({
  busca: z
    .string()
    .trim()
    .min(2, 'Informe ao menos 2 caracteres para buscar.')
    .max(200, 'Busca muito longa.'),
})

export type BuscaRegistroFormData = z.infer<typeof buscaRegistroSchema>
