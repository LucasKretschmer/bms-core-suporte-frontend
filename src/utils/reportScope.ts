/**
 * Escopo de listagens de tickets, compartilhado entre features (apontamentos,
 * tickets do cliente, etc.). Centraliza o literal para evitar duplicação.
 */
export type TicketScope = 'mine' | 'team' | 'all'

/**
 * Scope default para listagens de tickets, por papel.
 * Coordenador+ → 'all'; Atendente → 'mine'.
 *
 * UX apenas — o backend é a fonte de verdade. O valor enviado por Atendente é
 * apenas um default de UX: o backend resolve/sobrescreve o scope efetivo do
 * Atendente por segurança (A01) — hoje força `team` (118.6.3), independente do
 * valor enviado aqui. O default 'all' só tem efeito para quem o backend permite.
 */
export function defaultTicketScope(isCoordenadorOuAcima: boolean): TicketScope {
  return isCoordenadorOuAcima ? 'all' : 'mine'
}
