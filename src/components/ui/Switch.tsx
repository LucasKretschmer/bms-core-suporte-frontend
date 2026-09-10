import { clsx } from 'clsx'
import { useId } from 'react'

type SwitchProps = {
  checked: boolean
  onChange: (checked: boolean) => void
  /** Rótulo acessível — usado em aria-label quando não há label visível */
  label: string
  /** Se true, o label é apenas para leitores de tela (aria-label) */
  hideLabel?: boolean
  disabled?: boolean
  /**
   * 133 — travado por **regra de negócio** (não por indisponibilidade do controle).
   *
   * Bloqueia a mudança **mantendo o botão na ordem de tabulação**: o `disabled` nativo
   * tira o `<button>` do `Tab` e do leitor de tela, e o usuário de teclado nunca
   * alcançaria o controle **nem a explicação** apontada por `describedById`
   * (`rules/frontend.md` § Acessibilidade de teclado; `arquitetura.md` §7.1 item 4).
   *
   * Sem `opacity` e sem `pointer-events-none` no modo travado: reduzir a opacidade de um
   * trilho `bg-primary` **marcado** custa contraste não-textual (WCAG 1.4.11, piso 3:1)
   * sem ganho — quem comunica a trava é o texto visível.
   */
  ariaDisabled?: boolean
  /** id do texto que explica o estado do switch → `aria-describedby` (133). */
  describedById?: string
  /** ID do elemento — necessário quando há <label htmlFor> externo */
  id?: string
  className?: string
}

/**
 * Toggle (switch) acessível — retematizado com tokens do Design System Migrate.
 * role="switch" + aria-checked, operável por teclado (Enter/Espaço).
 * Hover por sombra — nunca muda cor de fundo no hover.
 */
export function Switch({
  checked,
  onChange,
  label,
  hideLabel = true,
  disabled = false,
  ariaDisabled = false,
  describedById,
  id: idProp,
  className,
}: SwitchProps) {
  const genId = useId()
  const id = idProp ?? genId

  function handleClick() {
    // `ariaDisabled` bloqueia a escrita tão de verdade quanto `disabled` — a diferença
    // é só que o controle continua focável (ver a doc da prop).
    if (disabled || ariaDisabled) return
    onChange(!checked)
  }

  const bloqueado = disabled || ariaDisabled

  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={hideLabel ? label : undefined}
      aria-disabled={ariaDisabled || undefined}
      aria-describedby={describedById}
      disabled={disabled}
      onClick={handleClick}
      className={clsx(
        'relative inline-flex h-5 w-9 shrink-0 items-center rounded-pill',
        'transition-shadow duration-150',
        'focus-visible:ring-2 focus-visible:ring-primary-light focus-visible:ring-offset-2',
        'hover:shadow-hover',
        checked ? 'bg-primary' : 'bg-border',
        bloqueado ? 'cursor-not-allowed' : 'cursor-pointer',
        disabled && 'opacity-50 pointer-events-none',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={clsx(
          'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-150',
          checked ? 'translate-x-4' : 'translate-x-0.5',
        )}
      />
    </button>
  )
}
