/**
 * Alternativa acessível por TECLADO ao clique em fatia/barra de gráfico (WCAG 2.1.1, nível A).
 *
 * ## Por que existe
 *
 * O Recharts renderiza as séries dentro de um `<svg>`: as barras e fatias **não** estão na
 * ordem de tabulação (o Recharts 3 marca os nós de série com `tabindex="-1"`, que é o
 * oposto de alcançável por `Tab` — serve só para foco programático/por clique). Logo, um
 * drill disponível **apenas** no `onClick` da série é funcionalidade **inalcançável por
 * teclado**.
 *
 * O padrão aqui é a generalização do que o `StatusDistributionChart` já fazia no modo
 * equipe (OBS-1 / QA 016): abaixo do gráfico, uma lista de `<button>` **reais** — um por
 * fatia/série/categoria — que dispara **exatamente o mesmo** callback de drill, com
 * **exatamente o mesmo alvo** que o clique passaria. É soma de caminho, nunca troca: o
 * `onClick` da série continua intacto.
 *
 * ## Requisitos de acessibilidade atendidos aqui (e por que assim)
 *
 * - `<button type="button">` nativo: papel correto, `Enter`/`Espaço` de graça, sem
 *   `role`/`tabIndex` manuais (o `<g>`/`<div>` clicável seria a alternativa pior).
 * - **Nome acessível descreve a AÇÃO** (`actionLabel` → `aria-label`), não só o rótulo:
 *   "Ver tickets do status Novo (5)" em vez de "Novo". Fora de contexto — que é como o
 *   leitor de tela lista os botões — "Novo" não diz o que o botão faz.
 * - **Foco visível**: `focus:ring-2 focus:ring-primary` (o `focus:outline-none` só troca o
 *   anel do agente pelo do design system, nunca o remove).
 * - **Cor nunca é o único sinal**: a amostra colorida é `aria-hidden` e puramente
 *   redundante — o rótulo e o valor são texto.
 *
 * ## Devolução do foco
 *
 * Nada a fazer aqui: o botão é um elemento focado de verdade quando o usuário o aciona,
 * então o `capture()` do `useReturnFocus` (que lê `document.activeElement` no handler que
 * ABRE o drill, em `dashboards/{support,onboarding}/index.tsx`) guarda **este** botão e o
 * `restore()` devolve o foco a ele ao fechar o modal. Ver `src/hooks/useReturnFocus.ts`.
 */

import React from 'react'
import { clsx } from 'clsx'

export type ChartDrillLegendItem = {
  /** Chave estável de lista (identidade do item, não índice). */
  key: string
  /** Rótulo visível — o mesmo nome da fatia/série/categoria no gráfico. */
  label: string
  /** Valor exibido ao lado do rótulo (contagem já formatada, se for o caso). */
  value: string | number
  /** Cor da amostra: a MESMA da fatia/barra correspondente. Redundante por definição. */
  color?: string
  /** Nome acessível do botão — descreve a ação e inclui o alvo. Obrigatório. */
  actionLabel: string
  /** Dispara o MESMO drill do clique na fatia, com o MESMO alvo. */
  onSelect: () => void
}

type ChartDrillLegendProps = {
  /** Nome acessível da lista (`aria-label` do `<ul>`), ex.: "Abrir tickets por status". */
  label: string
  items: ChartDrillLegendItem[]
  className?: string
}

export const ChartDrillLegend = React.memo(function ChartDrillLegend({
  label,
  items,
  className,
}: ChartDrillLegendProps) {
  if (items.length === 0) return null

  return (
    <ul className={clsx('mt-2 flex flex-wrap gap-2', className)} aria-label={label}>
      {items.map((item) => (
        <li key={item.key}>
          <button
            type="button"
            onClick={item.onSelect}
            className="inline-flex items-center gap-1.5 rounded-control border border-border px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary hover:shadow-hover"
            aria-label={item.actionLabel}
          >
            {item.color !== undefined && (
              <span
                aria-hidden="true"
                className="inline-block w-2 h-2 rounded-[2px]"
                style={{ backgroundColor: item.color }}
              />
            )}
            <span className="break-words">{item.label}</span>
            <strong>{item.value}</strong>
          </button>
        </li>
      ))}
    </ul>
  )
})
