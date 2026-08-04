import { clsx } from 'clsx'
import { useRef } from 'react'
import { tabId, tabPanelId } from './tabsIds'

export type TabItem<TId extends string> = {
  id: TId
  label: string
  /**
   * Contador opcional exibido ao lado do rótulo (ex.: "Precisa ação 3").
   *
   * `null` é aceito e tratado como AUSENTE: o valor costuma vir de um total do
   * backend, e "ausente" tem duas formas na fronteira HTTP (`undefined` = a chave
   * não veio; `null` = veio nula). Com `!== undefined` um `null` do wire renderizaria
   * a string "null" ao lado do rótulo (121/F4, `AP-FRONTEND-021`).
   */
  badge?: string | number | null
}

type TabsProps<TId extends string> = {
  items: TabItem<TId>[]
  value: TId
  onChange: (id: TId) => void
  /** Rótulo acessível do conjunto de abas (obrigatório: um `tablist` sem nome é opaco). */
  label: string
  /**
   * Prefixo estável dos ids. É prop (e não `useId` interno) de propósito: o
   * `tabpanel` é renderizado FORA deste componente e precisa do MESMO prefixo para
   * que `aria-controls`/`aria-labelledby` casem. Com `useId` interno as duas pontas
   * apontariam para ids diferentes — e `aria-controls` apontando para nada é um
   * defeito que nenhum teste de renderização pega.
   */
  baseId: string
  className?: string
}

/**
 * Abas acessíveis (padrão WAI-ARIA "Tabs with manual activation").
 *
 * - `role="tablist"` + `role="tab"` com `aria-selected` e `aria-controls`;
 * - somente a aba selecionada fica no fluxo de `Tab` (`tabIndex=0`); as demais são
 *   alcançadas por ←/→/Home/End dentro do tablist — é o que a spec exige e o que
 *   `.focus()` num teste jamais provaria (`rules/frontend.md` § travessia de `Tab`);
 * - ativação MANUAL: a seta move o foco, `Enter`/`Espaço` (clique nativo do
 *   `<button>`) troca o painel. Ativação automática dispararia requisição a cada
 *   tecla de navegação.
 *
 * ⚠️ CONTRATO DO PAINEL (121/F1) — quem usa renderiza **um `role="tabpanel"` para cada
 * aba**, não só para a selecionada:
 *
 * ```tsx
 * {items.map((i) => (
 *   <div key={i.id} role="tabpanel" hidden={i.id !== value}
 *        id={tabPanelId(baseId, i.id)} aria-labelledby={tabId(baseId, i.id)}>
 *     {i.id === value && conteudo}
 *   </div>
 * ))}
 * ```
 *
 * Motivo: `aria-controls` é emitido para **todas** as abas (é o que a APG pede), então
 * o painel de cada aba precisa existir no DOM — com um único painel, a aba inativa
 * aponta para um id inexistente (`getElementById` → `null`, medido pelo QA da 121) e
 * viola `aria-valid-attr-value`. O painel inativo vai **vazio e com `hidden`**: fica
 * fora da árvore de acessibilidade e fora do fluxo de `Tab`, e nada é buscado por ele.
 * ⚠️ Nunca ponha classe de `display` (`flex`, `grid`, `block`) no painel oculto —
 * qualquer uma delas vence o `[hidden]` da folha do agente e o painel reaparece.
 */
export function Tabs<TId extends string>({
  items,
  value,
  onChange,
  label,
  baseId,
  className,
}: TabsProps<TId>) {
  const listRef = useRef<HTMLDivElement>(null)

  function focarAba(indice: number) {
    const botoes = listRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
    botoes?.[indice]?.focus()
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const indiceAtual = items.findIndex((i) => i.id === value)
    if (indiceAtual < 0) return

    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault()
      const passo = e.key === 'ArrowRight' ? 1 : -1
      const proximo = (indiceAtual + passo + items.length) % items.length
      onChange(items[proximo].id)
      focarAba(proximo)
      return
    }
    if (e.key === 'Home') {
      e.preventDefault()
      onChange(items[0].id)
      focarAba(0)
      return
    }
    if (e.key === 'End') {
      e.preventDefault()
      onChange(items[items.length - 1].id)
      focarAba(items.length - 1)
    }
  }

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={label}
      onKeyDown={handleKeyDown}
      className={clsx('flex items-center gap-1 border-b border-line', className)}
    >
      {items.map((item) => {
        const isSelected = item.id === value
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            id={tabId(baseId, item.id)}
            aria-selected={isSelected}
            aria-controls={tabPanelId(baseId, item.id)}
            tabIndex={isSelected ? 0 : -1}
            onClick={() => onChange(item.id)}
            className={clsx(
              'px-4 py-2 text-sm rounded-t transition-shadow duration-150',
              'focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none',
              isSelected
                ? 'font-bold text-primary border-b-2 border-primary'
                : 'text-muted hover:shadow-hover',
            )}
          >
            {item.label}
            {/* `!= null` (e não `!== undefined`): pega os DOIS jeitos de o contador
                faltar — ver `TabItem.badge`. */}
            {item.badge != null && (
              <span className="ml-2 text-xs font-bold">{item.badge}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
