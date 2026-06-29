/**
 * Tipos da feature Movimentação Diária (021 — tela de logs).
 *
 * Espelha o contrato do backend:
 *   GET /api/v1/metrics/movimentacao-diaria → PaginatedResponse<MovimentacaoDiariaRowDto>
 *   (MovimentacaoDiariaDtos.cs — Id, Data, StatusBucket, StatusLabel?, EquipeId?,
 *    Equipe?, Quantidade, AtualizadoEm).
 *
 * IDs internos são number (padrão do workspace). Nunca usar `any`.
 */

/**
 * Linha do snapshot diário (uma por data × bucket/stage × equipe).
 * `statusLabel` e `equipe`/`equipeId` são anuláveis: linhas de fluxo (novos/
 * resolvidos/cancelados) não têm stage e tickets sem owner não têm equipe.
 */
export type MovimentacaoDiariaRowDto = {
  id: number
  /** Data do snapshot — string YYYY-MM-DD (DateOnly serializado pelo backend). */
  data: string
  /** Família do bucket: aberto|emandamento|fechado|cancelado|novos|resolvidos|cancelados. */
  statusBucket: string
  /** Rótulo legível do stage congelado no snapshot. null nas linhas de fluxo. */
  statusLabel: string | null
  /** ID interno da equipe (number). null = "Sem equipe". */
  equipeId: number | null
  /** Nome da equipe congelado no snapshot. null = "Sem equipe". */
  equipe: string | null
  /** Contagem do bucket/stage/equipe naquele dia (>= 0). */
  quantidade: number
  /** Horário da última atualização do snapshot (ISO com timezone). */
  atualizadoEm: string
}

/**
 * Buckets de status conhecidos. O valor é o que o backend envia em `statusBucket`
 * e também é aceito como filtro `statusBucket[]` no endpoint.
 *
 * Atenção: existem DUAS famílias de "cancelado":
 *   - `cancelado` (estoque, derivado do stage)
 *   - `cancelados` (fluxo, evento do dia §2.3)
 */
export type StatusBucket =
  | 'aberto'
  | 'emandamento'
  | 'fechado'
  | 'cancelado'
  | 'novos'
  | 'resolvidos'
  | 'cancelados'
