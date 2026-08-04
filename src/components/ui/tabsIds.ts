/**
 * Ids de aba/painel do `Tabs` — módulo próprio, sem componente.
 *
 * Vive fora de `Tabs.tsx` por dois motivos:
 *  1. `react-refresh/only-export-components`: exportar função ao lado de um
 *     componente quebra o fast refresh do arquivo (121/F5 — o lint acusava
 *     `Tabs.tsx:122,127`);
 *  2. as duas pontas do `aria-controls`/`aria-labelledby` são escritas em arquivos
 *     diferentes (o `tabpanel` é renderizado FORA do `Tabs`), e o único jeito de as
 *     duas casarem é derivarem do MESMO gerador — nunca de duas strings digitadas.
 */

/** Id do `role="tab"`. Use no `aria-labelledby` do painel correspondente. */
export function tabId(baseId: string, tabValue: string): string {
  return `${baseId}-tab-${tabValue}`
}

/** Id do `role="tabpanel"`. Use no `aria-controls` — já feito pelo `Tabs`. */
export function tabPanelId(baseId: string, tabValue: string): string {
  return `${baseId}-panel-${tabValue}`
}
