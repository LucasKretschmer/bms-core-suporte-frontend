/**
 * 121/FAT-5 (A2/D2) — cores das superfícies novas de faturamento.
 *
 * Duas responsabilidades, de propósito no mesmo arquivo:
 *  1. as CLASSES Tailwind (por token, nunca hex) usadas pelo badge "Na fatura";
 *  2. o INVENTÁRIO dos pares (texto sobre fundo) que a entrega introduz ou
 *     reaproveita, com o hex espelhado — insumo do teste de contraste.
 *
 * Por que o hex aparece aqui: jsdom/Vitest não resolve `var(--color-*)` sem o CSS
 * real carregado (mesma limitação já documentada em `appointments/statusColors.ts`).
 * Para que os dois lados não divirjam em silêncio, o teste companheiro LÊ
 * `src/styles/global.css` (e o `styles.css` do design system, para os tokens
 * reaproveitados) e exige que cada hex abaixo seja idêntico ao do CSS — o
 * inventário não é mantido à mão nas duas pontas (`rules/security.md` §
 * enumeração que dá poder a um invariante).
 */

/** Par de cor auditável: texto (`fg`) sobre fundo (`bg`), identificado pelos tokens. */
export type ParDeContraste = {
  /** Rótulo humano — aparece na mensagem de falha do teste. */
  label: string
  fgToken: string
  bgToken: string
  /** Hex espelhado do CSS. O teste confere a igualdade com o arquivo real. */
  fg: string
  bg: string
}

/**
 * Todo par de cores usado pelas superfícies novas desta entrega.
 * `4.5:1` é piso inviolável (`rules/frontend.md` § Contraste) — inclusive para os
 * pares REAPROVEITADOS: "já existia" não é medição.
 */
export const FATURA_CONTRAST_PAIRS: ParDeContraste[] = [
  // ── Novos (aditivos) ──
  {
    label: 'badge "Na fatura: Sim"',
    fgToken: '--color-fatura-sim-fg',
    bgToken: '--color-fatura-sim-bg',
    fg: '#046b04',
    bg: '#ddffdd',
  },
  {
    label: 'badge "Na fatura: Não"',
    fgToken: '--color-fatura-nao-fg',
    bgToken: '--color-fatura-nao-bg',
    fg: '#4a5a68',
    bg: '#f0f4f7',
  },
  // ── Reaproveitados (medidos, não herdados por associação) ──
  //
  // 🔴 132/F1 — os DOIS rótulos abaixo diziam "do modal", e o modal era o de exceções de
  // faturamento, que a 132/D7 apagou. Os PARES continuam reais (foram remedidos hoje), o
  // que envelheceu foi só a superfície nomeada: rótulo de allowlist que aponta para algo
  // removido passa a MENTIR, e é exatamente por isso que ele é reescrito no mesmo commit
  // em vez de o par ser retirado do inventário (`AP-QA-044`).
  //
  // Onde cada um vive hoje, verificado por grep em 09/09/2026:
  //  · muted sobre card   → `CompetenciaNota.tsx:101` (a `<ul>` da nota, dentro do
  //    `bg-card` da própria nota) e a ABA INATIVA do `Tabs` genérico (`Tabs.tsx:132`);
  //  · primary sobre card → a ABA ATIVA do mesmo `Tabs` (`Tabs.tsx:131`) e o link de
  //    ticket da tabela do painel do parceiro (`client-tickets/columns.tsx:84`).
  {
    label: 'texto secundário e aba inativa (muted sobre card)',
    fgToken: '--color-muted',
    bgToken: '--color-card',
    fg: '#666666',
    bg: '#ffffff',
  },
  {
    label: 'aba ativa e link em tabela (primary sobre card)',
    fgToken: '--color-primary',
    bgToken: '--color-card',
    fg: '#002f4f',
    bg: '#ffffff',
  },
  // ── 132/F4b — o `+2h` verde da coluna "Qtde. Plano (h)" ──
  //
  // 🔴 O verde do crédito PRECISA de medição, não de suposição: pares `-fg`/`-bg` do próprio
  // design system já reprovaram AA quatro vezes neste repo (AP-FRONTEND-011/014/015/018).
  //
  // Token reaproveitado de propósito: `--color-success-fg` é o MESMO que esta tela já usa no
  // `% do Plano` abaixo de 80% (`plan-consumption/columns.ts:55`). Nada de hex novo e nada de
  // classe da paleta padrão do Tailwind (`text-green-600`), que escaparia à repontagem de
  // tokens e a esta medição (AP-FRONTEND-014).
  //
  // Fundo: a célula da `DataTable` herda o `--color-card` do card do `ReportPageLayout` — a
  // tabela só pinta `bg-background` no `<th>` (`DataTable.tsx:73`) e a linha não muda de fundo
  // em nenhum estado (o hover é por SOMBRA, `DataTable.tsx:115`, padrão do design system). O
  // par "primary sobre card" acima já vive na MESMA célula-vizinha (o link de ticket do painel
  // do parceiro), o que confirma a superfície por precedente, não por leitura de classe.
  {
    label: 'crédito de horas (+Xh) na coluna Qtde. Plano',
    fgToken: '--color-success-fg',
    bgToken: '--color-card',
    fg: '#008000',
    bg: '#ffffff',
  },
]

/** Classes do badge "Na fatura" — por token, nunca hex (rules/frontend.md § Estilos). */
export const NA_FATURA_CLASSES = {
  sim: 'bg-fatura-sim-bg text-fatura-sim-fg',
  nao: 'bg-fatura-nao-bg text-fatura-nao-fg',
} as const
