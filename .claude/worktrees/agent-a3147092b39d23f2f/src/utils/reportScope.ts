/**
 * Escopo de listagens de tickets, compartilhado entre features (apontamentos,
 * tickets do cliente, etc.). Centraliza o literal para evitar duplicação.
 */
export type TicketScope = 'mine' | 'team' | 'all'

/**
 * Scope default para listagens de tickets, por papel.
 * Coordenador+ → 'all'; Atendente → 'mine'.
 *
 * UX apenas — o backend é a fonte de verdade (força 'mine' p/ Atendente por
 * segurança, A01). O default 'all' só tem efeito para quem o backend permite.
 */
export function defaultTicketScope(isCoordenadorOuAcima: boolean): TicketScope {
  return isCoordenadorOuAcima ? 'all' : 'mine'
}
