import { z } from 'zod'

// ── Enums de domínio ──────────────────────────────────────────────────────────
export type SyncStatus = 'executando' | 'concluido' | 'erro'
export type SyncDisparo = 'automatico' | 'manual'
export type RegistroTipo = 'ticket' | 'projeto'

// ── DTOs ──────────────────────────────────────────────────────────────────────

/** Espelha SincronizacaoLogDto do backend */
export type SincronizacaoLogDto = {
  sincronizacaologsid: string
  status: SyncStatus
  disparo: SyncDisparo
  iniciadoem: string
  finalizadoem: string | null
  duracaoms: number | null
  ticketsupserted: number
  ticketsignorados: number
  projetosupserted: number
  projetosignorados: number
  empresasresolvidas: number
  contatosresolvidos: number
  mensagemerro: string | null
}

/** Status atual do sincronizador */
export type SincronizacaoStatusDto = {
  isOnline: boolean
  status: SyncStatus | null
  ultimaExecucao: {
    iniciadoem: string
    finalizadoem: string | null
    duracaoms: number | null
    status: SyncStatus
    contadores: {
      ticketsupserted: number
      ticketsignorados: number
      projetosupserted: number
      projetosignorados: number
      empresasresolvidas: number
      contatosresolvidos: number
    }
  } | null
  intervaloMinutos: number
}

/** Resultado do run manual */
export type RunResultDto = {
  logId: string
  status: SyncStatus
}

/** Resultado da sincronização de equipes */
export type SyncTeamsResultDto = {
  ownersProcessed: number
  teamsProcessed: number
}

/** Registro para manutenção */
export type RegistroDto = {
  hubspotId: string
  tipo: RegistroTipo
  assunto: string
  status: string
  clienteNome: string | null
  criadoem: string
  desativadoem: string | null
}

/** Parâmetros da listagem de logs */
export type ListLogsParams = {
  status?: SyncStatus
  page: number
  pageSize: number
  sortBy?: 'iniciadoem' | 'status' | 'duracaoms'
  sortDirection?: 'asc' | 'desc'
}

/** Parâmetros de busca de registros */
export type BuscaRegistrosParams = {
  busca: string
}

// ── Schemas Zod ───────────────────────────────────────────────────────────────

/** Valida o campo de busca de registros */
export const buscaRegistroSchema = z.object({
  busca: z
    .string()
    .min(2, 'Informe ao menos 2 caracteres para buscar.')
    .max(200, 'Busca muito longa.'),
})

export type BuscaRegistroFormData = z.infer<typeof buscaRegistroSchema>
