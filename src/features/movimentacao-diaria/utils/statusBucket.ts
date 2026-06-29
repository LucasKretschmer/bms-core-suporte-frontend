/**
 * Mapeamento puro de bucket de status → rótulo PT-BR e variante de Badge.
 *
 * AP-SECURITY-001: os rótulos são constantes PT-BR controladas pelo frontend,
 * nunca a categoria HubSpot crua. Quando o backend manda um `statusLabel` (linhas
 * de estoque por stage), exibimos ele; o bucket dá apenas a cor/variante.
 *
 * Funções puras — alvo de teste (testar lógica, não render).
 */

import type { StatusBucket } from '../types/movimentacaoDiaria'

const BUCKET_LABELS: Record<StatusBucket, string> = {
  aberto: 'Em aberto',
  emandamento: 'Em atendimento',
  fechado: 'Resolvido',
  cancelado: 'Cancelado',
  novos: 'Novos',
  resolvidos: 'Resolvidos',
  cancelados: 'Cancelados',
}

/**
 * Opções para o filtro de bucket (ordem estável de exibição).
 * Inclui as duas famílias de cancelado, com sufixo para diferenciar.
 */
export const STATUS_BUCKET_OPTIONS: { value: StatusBucket; label: string }[] = [
  { value: 'aberto', label: 'Em aberto (estoque)' },
  { value: 'emandamento', label: 'Em atendimento (estoque)' },
  { value: 'fechado', label: 'Resolvido (estoque)' },
  { value: 'cancelado', label: 'Cancelado (estoque)' },
  { value: 'novos', label: 'Novos (fluxo)' },
  { value: 'resolvidos', label: 'Resolvidos (fluxo)' },
  { value: 'cancelados', label: 'Cancelados (fluxo)' },
]

/** Verifica se o valor recebido é um bucket conhecido (defesa contra dado inesperado). */
export function isStatusBucket(value: string): value is StatusBucket {
  return value in BUCKET_LABELS
}

/**
 * Rótulo de exibição para uma linha de log.
 * Preferência: statusLabel congelado (estoque por stage) → rótulo do bucket → o
 * valor cru do bucket (fallback para nunca quebrar a tabela).
 */
export function formatStatusDisplay(statusBucket: string, statusLabel: string | null): string {
  if (statusLabel && statusLabel.trim().length > 0) return statusLabel
  if (isStatusBucket(statusBucket)) return BUCKET_LABELS[statusBucket]
  return statusBucket
}

/** Rótulo apenas do bucket (sem o statusLabel) — usado no filtro/legenda. */
export function formatBucketLabel(statusBucket: string): string {
  return isStatusBucket(statusBucket) ? BUCKET_LABELS[statusBucket] : statusBucket
}
