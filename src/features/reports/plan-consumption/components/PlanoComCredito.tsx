/**
 * 132/F4b (D11 · D15 · D21) — a célula da coluna **"Qtde. Plano (h)"**: `15h + 2h`.
 *
 * É o layout que o **usuário escreveu à mão** (`prd.md` §5.1) e cujos números ele corrigiu:
 * plano base, o crédito da competência em verde, e um ⓘ que explica o crédito.
 *
 * ─── Semântica ANTES de cor (WCAG 1.4.1 — cor nunca é o único meio) ─────────────────────────
 *
 * Três coisas comunicam "isto é crédito", e nenhuma delas é o verde:
 *  1. o sinal **`+`** literal, no texto visível;
 *  2. o **`sr-only`** que nomeia o crédito por extenso ("mais 2h de Crédito de Suporte");
 *  3. o **ⓘ** ao lado, com o tooltip.
 * Tire o verde e a informação continua inteira — o verde é **reforço**, exatamente como o selo
 * do `(?)` desta mesma tela já faz.
 *
 * O `+ 2h` visível é `aria-hidden` e o `sr-only` carrega o mesmo dado por extenso: sem isso o
 * leitor de tela leria *"15h + 2h mais 2h de Crédito de Suporte"* — o valor duas vezes. Os dois
 * canais dizem a mesma coisa, cada um na sua língua.
 *
 * ─── Por que o ⓘ é o `InfoIcon` do design system, e não um tooltip novo ─────────────────────
 *
 * `InfoIcon` já é um `<button>` real com `onFocus`/`onBlur` e `aria-label={tooltip}`
 * (`components/ui/InfoIcon.tsx:99-116`): chega por **`Tab`**, não só por hover. E ele já traz
 * `stopPropagation` + `preventDefault` em `onClick`/`onPointerDown` (`:90-96`) — necessário
 * porque a linha da `DataTable` é `role="button"` com `tabIndex={0}` (`DataTable.tsx:100-101`)
 * e um clique no ⓘ abriria o drawer do cliente.
 *
 * ⚠️ **Precedente novo no repo:** varridos os 16 consumidores do `InfoIcon`, nenhum o usava
 * dentro de **célula** de `DataTable` (todos em `<th>` via `headerInfo`, em `KpiCard`, em
 * `Modal` ou em bloco de filtro). Por isso os dois testes próprios de `PlanoComCredito.test.tsx`
 * e de `index.test.tsx`: (a) clicar no ⓘ **não** abre o drawer; (b) `Tab` alcança o ⓘ.
 *
 * ─── Regressão zero (PRD §5.1: "sem crédito, nada muda") ───────────────────────────────────
 *
 * `temCredito === false` renderiza **apenas** o texto do plano base — nenhum `+`, nenhum
 * `sr-only`, nenhum `<button>`. Vale para os DOIS ramos de ausência (chave ausente e `0`), que
 * são visualmente idênticos de propósito; quem os distingue é `data-credito-conhecido`, e é ele
 * que impede um `?? 0` de passar em todo teste visual (ver `shared/utils/planoEfetivo.ts`).
 */

import { InfoIcon } from '../../../../components/ui/InfoIcon'
import {
  TOOLTIP_CREDITO_PLANO,
  srCreditoSufixo,
  textoCreditoVisivel,
} from '../../shared/utils/creditoTexts'
import { derivarPlanoEfetivo, formatHorasCompacto } from '../../shared/utils/planoEfetivo'
import type { EntradaDoPlanoEfetivo } from '../../shared/utils/planoEfetivo'

type PlanoComCreditoProps = {
  /**
   * A linha do wire. Tipo **estrutural** (não `PlanConsumptionItemDto`) para que a mesma célula
   * sirva ao Relatório do Cliente em 132/F9 sem duplicar componente.
   *
   * ⛔ O campo `creditos[].rotulo` do wire **não é lido aqui** — o rótulo exibido é a constante
   * local `ROTULO_CREDITO_PUBLICO` (D15). Ver `creditoTexts.ts`.
   */
  item: EntradaDoPlanoEfetivo
}

export function PlanoComCredito({ item }: PlanoComCreditoProps) {
  const { baseHoras, creditoHoras, temCredito, creditoConhecido } = derivarPlanoEfetivo(item)

  // D21 — compacto SÓ aqui: `formatHorasCompacto(15)` = "15h", nunca "15h 0m". As outras
  // colunas da tela seguem em `formatHours`, e o `% do Plano` segue com 1 casa.
  const creditoFormatado = formatHorasCompacto(creditoHoras)

  return (
    <span
      className="inline-flex items-center justify-end gap-1"
      // O único discriminador entre "não sei" e "não há" — os dois renderizam o mesmo texto.
      data-credito-conhecido={String(creditoConhecido)}
    >
      <span>{formatHorasCompacto(baseHoras)}</span>
      {temCredito && (
        <>
          <span
            aria-hidden="true"
            className="text-success-fg font-medium"
            data-testid="plano-credito"
          >
            {textoCreditoVisivel(creditoFormatado)}
          </span>
          <span className="sr-only">{srCreditoSufixo(creditoFormatado)}</span>
          <InfoIcon tooltip={TOOLTIP_CREDITO_PLANO} />
        </>
      )}
    </span>
  )
}
