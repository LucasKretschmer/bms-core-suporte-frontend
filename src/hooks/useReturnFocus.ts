/**
 * Devolução do foco ao gatilho ao fechar um overlay (§5.3 — "modal com foco preso **e**
 * devolve o foco ao gatilho").
 *
 * São **dois mecanismos com donos diferentes**: a prisão do foco é do `Modal`
 * compartilhado; a devolução é de **QUEM ABRE** — decisão registrada no próprio
 * componente (`components/ui/Modal.tsx`, bloco "O QUE ELE NÃO FAZ", que aponta
 * `BillingExceptionsCard.handleClose` como referência).
 *
 * ## Origem (122/CONSOL-1)
 *
 * Este arquivo unifica dois hooks criados em paralelo na demanda 122 para o MESMO
 * requisito: `features/ticket-detail/hooks/useReturnFocus.ts` (A11Y-2 — de onde vêm
 * `release`/`adopt`) e `features/dashboards/shared/hooks/useTriggerFocusReturn.ts`
 * (A11Y-3 — de onde vêm o aceite de `SVGElement`, a recusa do `documentElement` e o
 * retorno memoizado). Consumidores: `dashboards/support`, `dashboards/onboarding` e
 * `ticket-detail` (3 instâncias).
 *
 * ## Por que `document.activeElement` e não um `triggerRef`
 *
 * O irmão `reports/plan-consumption/components/BillingExceptionsCard.tsx` usa `triggerRef`
 * porque o modal dele tem **um** gatilho — um `Button` (forwardRef) renderizado **uma**
 * vez. Não é o caso de nenhum consumidor daqui, e **quem decide não é o `forwardRef`, é a
 * CARDINALIDADE dos gatilhos**:
 *
 * - `ticket-detail`: cada um dos três modais tem mais de um gatilho, e o principal existe
 *   uma vez **por apontamento** (`<button>` nativo dentro do `TimeEntryCard`). Um `ref`
 *   único no pai não teria como saber qual card abriu.
 * - `dashboards`: os 8 pontos de abertura convergem num único estado (`activeDrill`) e os
 *   gatilhos são **heterogêneos** — `KpiCard` (`<div role="button">`, sem `forwardRef`),
 *   linha de tabela (`<tr role="button">`), botão de status e **fatia de gráfico Recharts**
 *   (nó SVG, para o qual não existe elemento React nosso a referenciar).
 *
 * O que existe em comum é "o elemento que estava focado quando o overlay abriu". Mesmo
 * padrão do irmão `reports/plan-consumption/index.tsx:67-81`.
 *
 * ## Por que o tipo aceita `SVGElement` (medido, não presumido) — NÃO REMOVER
 *
 * Medição do A11Y-3 em jsdom + `@testing-library/user-event` (que implementa o algoritmo
 * de foco por clique do HTML: foca o **nó focável mais próximo**) com Recharts 3.8: a
 * `<svg class="recharts-surface">` nasce com `role="application" tabindex="0"`; clicar
 * numa barra deixa o foco em `<g class="recharts-zIndex-layer_300" tabindex="-1">`;
 * clicar numa fatia de donut deixa o foco em `<path class="recharts-sector" tabindex="-1">`.
 * Ou seja, o clique em gráfico **não** larga o foco no `body` — ele pousa num
 * **SVGElement**, que implementa `HTMLOrSVGElement` e portanto tem `.focus()`.
 *
 * Um guarda `ativo instanceof HTMLElement` (o reflexo natural de quem escreve isto do
 * zero) descartaria em silêncio **todos** os gatilhos de gráfico, e a devolução viraria
 * no-op só ali — falha parcial silenciosa. A mutação `HOOK-SEM-SVG` derruba 3 testes.
 * ⚠️ A medição é do modelo do jsdom/user-event; **não foi medida em navegador real**.
 *
 * `body`/`<html>` são recusados de propósito: devolver o foco ao `body` não cumpre o
 * requisito, cumpre a asserção "não é o gatilho errado". Preferimos não fazer nada e
 * declarar o limite a fingir atendimento.
 *
 * ⚠️ LIMITE CONHECIDO, não coberto por teste: em navegador que não foca `<button>` ao
 * clicar (Safari/macOS), `document.activeElement` no momento do clique é o `<body>` —
 * `capture()` guarda `null` e `restore()` vira no-op. Não é regressão (é o comportamento
 * atual das telas), mas também não é resolvido aqui.
 */

import { useCallback, useMemo, useRef } from 'react'

/** Elemento que pode receber foco programático — `HTMLOrSVGElement` não é um tipo-valor. */
export type FocusableNode = HTMLElement | SVGElement

export type ReturnFocus = {
  /** Guarda o elemento focado AGORA (o gatilho). Chamar no handler que ABRE o overlay. */
  capture: () => void
  /** Devolve o foco ao gatilho guardado e esquece. Chamar no handler que FECHA o overlay. */
  restore: () => void
  /**
   * Entrega o gatilho guardado e esquece — para **ENCADEAR** overlays: quando um modal
   * abre outro, o gatilho original continua sendo o dono do foco, porque o botão de dentro
   * do primeiro modal desaparece junto com ele (ver `onRequestCancel` em
   * `features/ticket-detail/index.tsx`).
   */
  release: () => FocusableNode | null
  /**
   * Assume um gatilho capturado por outro fluxo (o outro lado do encadeamento).
   * Existe como método — e não como acesso ao `ref` cru — porque mutar de fora um valor
   * devolvido por hook reprova na regra `react-hooks/immutability` do eslint (medido no
   * A11Y-2: `tsc` e a suíte passavam, só o lint pegou).
   */
  adopt: (gatilho: FocusableNode | null) => void
}

export function useReturnFocus(): ReturnFocus {
  const triggerRef = useRef<FocusableNode | null>(null)

  const capture = useCallback(() => {
    const ativo = document.activeElement
    const ehFocavel = ativo instanceof HTMLElement || ativo instanceof SVGElement
    // O `body`/`<html>` não são gatilho: guardá-los faria `restore()` "devolver" o foco
    // para lugar nenhum e mascararia a ausência de captura com um no-op silencioso.
    triggerRef.current =
      ehFocavel && ativo !== document.body && ativo !== document.documentElement
        ? ativo
        : null
  }, [])

  const restore = useCallback(() => {
    const gatilho = triggerRef.current
    triggerRef.current = null
    if (!gatilho) return
    // setTimeout(0): o Modal desmonta no mesmo commit — focar antes seria no-op. Mesma
    // fidelidade dos irmãos (`BillingExceptionsCard.handleClose`, `plan-consumption`).
    window.setTimeout(() => {
      // A verificação de presença fica DENTRO do timer: é aqui que o nó pode ter sumido
      // (a própria ação do modal removeu o gatilho, ou a seção re-renderizou enquanto ele
      // estava aberto). Fora, no instante do clique, ela é trivialmente verdadeira.
      if (document.contains(gatilho)) gatilho.focus()
    }, 0)
  }, [])

  const release = useCallback(() => {
    const gatilho = triggerRef.current
    triggerRef.current = null
    return gatilho
  }, [])

  const adopt = useCallback((gatilho: FocusableNode | null) => {
    triggerRef.current = gatilho
  }, [])

  return useMemo(
    () => ({ capture, restore, release, adopt }),
    [capture, restore, release, adopt],
  )
}
