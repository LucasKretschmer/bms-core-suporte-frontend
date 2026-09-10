/**
 * Textos da tela de Motivos de Crédito (132/F6), com a **âncora** de cada afirmação ao
 * lado (`AP-FRONTEND-022`: texto de UI que afirma comportamento do sistema é código, não
 * copy — ninguém abre o backend para conferir um adjetivo).
 */

/**
 * Explicação do bloqueio do motivo semeado. Aparece **visível na linha**, não só em
 * `title`: ação desabilitada sem motivo dito é o defeito clássico (`rules/frontend.md`
 * § Acessibilidade de teclado, `AP-QA-007`).
 *
 * Âncoras das duas afirmações:
 * - *"não pode ser renomeado nem excluído"* — `analise-backend.md` §7.3: *"`MOTIVO_DE_SISTEMA`:
 *   `Sistema == true` **não** é renomeável nem removível"*; `PUT` e `DELETE` devolvem
 *   `409 MOTIVO_DE_SISTEMA`. Não é escolha da tela: o servidor recusa os dois.
 * - *"o crédito automático não encontraria o motivo"* — `arquitetura.md:886-889`: o processo
 *   resolve o motivo **pela flag `sistema`, esperando exatamente 1**; zero ⇒ falha em voz alta.
 */
export const MOTIVO_DE_SISTEMA_EXPLICACAO =
  'Motivo usado pelo processo automático de crédito: não pode ser renomeado nem excluído. ' +
  'Sem ele, o crédito automático não encontraria o motivo e falharia na virada da competência.'

/**
 * Ação sugerida no `409 MOTIVO_EM_USO`.
 *
 * ⚠️ **Não diz "desative o motivo"** — e é de propósito. A tela de motivos **não tem** como
 * desativar: o contrato desta demanda não expõe `PATCH` nem `isActive` no corpo do `PUT`
 * (`arquitetura.md:880-884`, `analise-backend.md` §7.3 — `PUT { nome }`). Mandar o usuário
 * fazer algo que a interface não oferece é exatamente o `AP-FRONTEND-022`. A ação abaixo
 * existe de verdade: os créditos são excluíveis na tela de Créditos
 * (`DELETE /api/v1/hour-credits/{id}`).
 *
 * Divergência registrada para o Manager: `analise-frontend.md` §8 sugere *"desative em vez
 * de excluir"*.
 */
export const MOTIVO_EM_USO_ACAO =
  'Exclua ou estorne os créditos que usam este motivo antes de excluí-lo.'

/** Ação do `409 MOTIVO_DUPLICADO` — unicidade case-insensitive entre motivos vivos. */
export const MOTIVO_DUPLICADO_ACAO = 'Escolha um nome diferente.'
