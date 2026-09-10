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
 * 🔴 **Corrigido na 138/B1.** O texto anterior dizia *"Exclua **ou estorne** os créditos"* —
 * e estornar é, ao mesmo tempo, **ineficaz** e **inexecutável**:
 *
 * - **Não libera o motivo.** A guarda é `TemCreditoVivoAsync` = `motivoid = @id AND
 *   desativadoem IS NULL` (`MotivoCreditoRepository.cs:67-70`), e o estorno só carimba
 *   `estornadoem` (`CreditoAutomaticoService.cs:596-597`) — a linha continua viva. O próprio
 *   contrato diz isso por extenso: *"Crédito estornado conta como em uso… só o soft delete do
 *   crédito o tira da contagem"* (`IMotivoCreditoRepository.cs:42-50`).
 * - **Não existe botão nenhum.** Não há `POST /hour-credits/{id}/estornar`, não há
 *   `EstornarAsync` no service, não há ação de estorno na UI. O único write site de
 *   `EstornadoEm` é a reconciliação automática. Medido pelo QA backend da 132.
 *
 * ⚠️ **Também não diz "reclassifique"**, embora trocar o `motivoId` no `PUT
 * /api/v1/hour-credits/{id}` de fato libere o motivo: a listagem de créditos **não aceita
 * filtro por `motivoId`** (nem controller, nem DTO, nem repositório, nem `search`, que só
 * cobre cliente/CNPJ/chamado) ⇒ o usuário não tem como **encontrar** os créditos daquele
 * motivo. Instrução verdadeira e inalcançável é o mesmo `AP-FRONTEND-022` com outro verbo.
 *
 * ⚠️ **Também não diz "desative o motivo"** — não existe `PATCH` nem `isActive` no corpo do
 * `PUT` de motivo (`PUT { nome }`, `analise-backend.md` §7.3).
 *
 * ⇒ Sobra **uma** ação executável de ponta a ponta hoje: excluir os créditos, pelo botão
 * *excluir* da tela de Créditos (`DELETE /api/v1/hour-credits/{id}`). "na tela de Créditos"
 * diz **onde**: o erro aparece em `/motivos-credito`, a ação vive em `/creditos`.
 *
 * 🔴 **Esta frase é a MESMA que o servidor devolve**, verbatim, em
 * `FaturamentoConflitos.MotivoEmUso()` (backend). Não é coincidência nem duplicação
 * descuidada: `getHourCreditReasonErrorMessage` concatena a mensagem do servidor com esta
 * ação quando o `includes` **não** casa (`hourCreditReasonErrorMessage.ts:73-75`), e foi
 * exatamente isso que produzia um toast com **duas** instruções contraditórias na mesma
 * frase. As duas pontas convergirem é o que faz o toast dizer **uma** coisa só — e há teste
 * de convergência dedicado a isso (`hourCreditReasonErrorMessage.test.ts`). **Ao mudar este
 * texto, mude `FaturamentoConflitos.MotivoEmUso()` no mesmo passo.**
 */
export const MOTIVO_EM_USO_ACAO =
  'Exclua os créditos que usam este motivo, na tela de Créditos, antes de excluí-lo.'

/** Ação do `409 MOTIVO_DUPLICADO` — unicidade case-insensitive entre motivos vivos. */
export const MOTIVO_DUPLICADO_ACAO = 'Escolha um nome diferente.'
