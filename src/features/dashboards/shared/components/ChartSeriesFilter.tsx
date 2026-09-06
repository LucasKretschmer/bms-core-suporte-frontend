/**
 * Filtro de séries de gráfico — "deixar apenas um status selecionado" (123/D3b).
 *
 * ## Desenho (e por que assim)
 *
 * O pedido literal do QA é *isolar uma série* ("deixar apenas um status selecionado, como
 * por exemplo 'Cancelados'"). Modelamos isso como **escolha única** entre `N + 1` opções:
 * `Todas` (padrão) + uma opção por série. Consequências, que são exatamente os requisitos:
 *
 * - **Isolar custa UMA ação** (um clique, ou `Tab` + `Enter`). Num modelo multi-seleção
 *   (uma chave por série) isolar "Cancelados" custaria desmarcar as outras quatro.
 * - **O caminho de volta nunca some:** o botão `Todas` está SEMPRE na tela e SEMPRE
 *   habilitado, e além dele acionar a série já isolada devolve todas. Não existe estado
 *   alcançável sem saída (é defeito recorrente neste projeto, não detalhe de UX).
 *
 * O que se perde: subconjuntos arbitrários (ver 2 de 5 séries). Foi trocado de propósito
 * pelo custo de isolamento acima; se o produto pedir subconjunto, o tipo de `selected`
 * (`string | null`) é o ponto de extensão.
 *
 * ## Acessibilidade
 *
 * - `<button type="button">` REAIS (mesmo padrão do `ChartDrillLegend`): papel correto,
 *   `Enter`/`Espaço` de graça, alcançáveis por `Tab` sem `role`/`tabIndex` manuais.
 *   O Recharts renderiza a legenda nativa dentro do `<svg>`, fora da ordem de tabulação —
 *   por isso a legenda interativa vive no HTML, ao lado do gráfico, e não no `<Legend />`.
 * - **Estado anunciado** por `aria-pressed` (botão de alternância): o leitor de tela diz
 *   "pressionado" na opção vigente. Estado NÃO é comunicado só por cor: a opção vigente
 *   também muda de peso tipográfico e de borda.
 * - A amostra de cor é `aria-hidden` e puramente redundante — o rótulo é texto.
 * - O grupo tem nome acessível (`role="group"` + `aria-labelledby` no rótulo VISÍVEL),
 *   para que os botões não apareçam soltos na lista de controles do leitor de tela.
 *
 * ## Onde mora o estado
 *
 * Fora daqui: o componente é controlado (`selected` / `onChange`). Quem o usa mantém o
 * estado em `useState` local — **não** vai para a URL nem para o servidor. Justificativa
 * no consumidor (`LineChartMovimentacao`).
 */

import React, { useId } from 'react'
import { clsx } from 'clsx'

export type ChartSeriesFilterItem = {
  /** Chave estável da série — a mesma `dataKey` do gráfico. Identidade, nunca índice. */
  key: string
  /** Rótulo visível da série — o mesmo nome exibido no tooltip. */
  label: string
  /** Cor da série. Redundante por definição (o rótulo é texto). */
  color?: string
}

type ChartSeriesFilterProps = {
  /** Rótulo VISÍVEL do grupo, ex.: "Séries:". Também é o nome acessível do grupo. */
  label: string
  items: ChartSeriesFilterItem[]
  /** Série isolada. `null` = todas visíveis. */
  selected: string | null
  /** Recebe a chave a isolar, ou `null` para voltar a exibir todas. */
  onChange: (key: string | null) => void
  /** Rótulo da opção que devolve todas as séries. */
  allLabel?: string
  className?: string
}

const CHIP_BASE =
  'inline-flex items-center gap-1.5 rounded-control border px-2 py-1 text-xs text-foreground ' +
  'hover:shadow-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-primary'

const CHIP_ON = 'border-primary bg-info-bg font-semibold'
const CHIP_OFF = 'border-border bg-card font-normal'

export const ChartSeriesFilter = React.memo(function ChartSeriesFilter({
  label,
  items,
  selected,
  onChange,
  allLabel = 'Todas',
  className,
}: ChartSeriesFilterProps) {
  const labelId = useId()

  if (items.length === 0) return null

  const todasAtivo = selected === null

  return (
    <div className={clsx('flex flex-wrap items-center gap-2', className)}>
      <span id={labelId} className="text-xs text-muted">
        {label}
      </span>
      <div role="group" aria-labelledby={labelId} className="flex flex-wrap gap-2">
        {/* Caminho de volta — sempre presente, sempre habilitado. */}
        <button
          type="button"
          aria-pressed={todasAtivo}
          onClick={() => onChange(null)}
          className={clsx(CHIP_BASE, todasAtivo ? CHIP_ON : CHIP_OFF)}
        >
          {allLabel}
        </button>

        {items.map((item) => {
          const ativo = selected === item.key
          return (
            <button
              key={item.key}
              type="button"
              aria-pressed={ativo}
              // Acionar a série já isolada devolve todas — segundo caminho de volta.
              onClick={() => onChange(ativo ? null : item.key)}
              className={clsx(CHIP_BASE, ativo ? CHIP_ON : CHIP_OFF)}
            >
              {item.color !== undefined && (
                <span
                  aria-hidden="true"
                  className="inline-block h-2 w-2 rounded-[2px]"
                  style={{ backgroundColor: item.color }}
                />
              )}
              <span className="break-words">{item.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
})
