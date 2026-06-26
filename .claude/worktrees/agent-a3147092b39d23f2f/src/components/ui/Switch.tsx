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
  /** ID do elemento — necessário quando há <label htmlFor> externo */
  id?: string
  className?: string
}

/**
 * Toggle (switch) acessível do Design System BMS.
 * role="switch" + aria-checked, operável por teclado (Enter/Espaço).
 * Hover por sombra — nunca muda cor de fundo no hover.
 */
export function Switch({
  checked,
  onChange,
  label,
  hideLabel = true,
  disabled = false,
  id: idProp,
  className,
}: SwitchProps) {
  const genId = useId()
  const id = idProp ?? genId

  function handleClick() {
    if (!disabled) onChange(!checked)
  }

  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={hideLabel ? label : undefined}
      disabled={disabled}
      onClick={handleClick}
      className={clsx(
        'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full',
        'transition-shadow duration-150 cursor-pointer',
        'focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1',
        'hover:shadow-[0_1px_3px_1px_rgba(0,0,0,0.15)]',
        checked ? 'bg-primary' : 'bg-border',
        disabled && 'opacity-50 cursor-not-allowed pointer-events-none',
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
