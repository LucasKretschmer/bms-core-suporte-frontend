/**
 * Definição ÚNICA de "focável" usada pelo trap de foco do `Modal` (121/F2) e por quem
 * precisa fechar o ciclo do próprio lado — hoje só a **sentinela de foco** do preview de
 * PDF (`ClientReportPdf`, 121/F-28 · D21).
 *
 * Extraído do `Modal.tsx` sem nenhuma mudança de comportamento: o `Modal` só exporta
 * componente (regra `react-refresh/only-export-components`), e o consumidor precisa da
 * MESMA noção de focável — seletor paralelo mantido à mão é duas fontes de verdade que
 * divergem, e a divergência aqui é silenciosa (o foco vai para o lugar errado, sem erro).
 */

/**
 * Elementos que participam do fluxo de `Tab`. `[tabindex="-1"]` é excluído no próprio
 * seletor (e não pela propriedade `tabIndex`) porque é o atributo que o React escreve —
 * é assim que a aba inativa do `Tabs` e o próprio contêiner do dialog ficam fora do
 * ciclo do trap.
 */
export const SELETOR_FOCAVEL = [
  'a[href]:not([tabindex="-1"])',
  'button:not([disabled]):not([tabindex="-1"])',
  'input:not([disabled]):not([type="hidden"]):not([tabindex="-1"])',
  'select:not([disabled]):not([tabindex="-1"])',
  'textarea:not([disabled]):not([tabindex="-1"])',
  'iframe:not([tabindex="-1"])',
  'summary:not([tabindex="-1"])',
  '[contenteditable="true"]:not([tabindex="-1"])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ')

/**
 * Focáveis DENTRO do contêiner, em ordem de documento.
 *
 * ⚠️ Nada de `offsetParent`/`getClientRects()` para filtrar invisíveis: em jsdom eles
 * são sempre nulos/zerados, então o filtro devolveria lista **vazia** e o trap ficaria
 * inerte justamente nos testes que existem para prová-lo (`AP-FRONTEND-027`). A exclusão
 * é pelo que é semântico e observável nos dois ambientes: `[hidden]` e
 * `aria-hidden="true"`.
 *
 * A exclusão por `aria-hidden` é **carga estrutural** para a sentinela de foco do
 * `ClientReportPdf`: é ela que mantém a sentinela fora do ciclo do `Tab` (senão a
 * sentinela viraria o último focável do dialog e o `Shift+Tab` do primeiro pararia de
 * alcançar o iframe). Travado por teste nos dois lados.
 */
export function focaveisDentro(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(SELETOR_FOCAVEL)).filter(
    (el) => el.closest('[hidden], [aria-hidden="true"]') === null,
  )
}
