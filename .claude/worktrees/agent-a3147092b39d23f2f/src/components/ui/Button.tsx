import { clsx } from 'clsx'

type ButtonVariant = 'primary' | 'secondary' | 'ghost'

type ButtonProps = {
  children?: React.ReactNode
  variant?: ButtonVariant
  icon?: React.ReactNode
  className?: string
  onClick?: () => void
  disabled?: boolean
  isLoading?: boolean
  type?: 'button' | 'submit' | 'reset'
  'aria-label'?: string
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-primary text-white border border-primary',
  secondary:
    'bg-card text-foreground border border-border',
  ghost:
    'bg-transparent text-foreground border border-transparent',
}

/** Botão do Design System BMS. Hover sempre por sombra — nunca muda cor. */
export function Button({
  children,
  variant = 'primary',
  icon,
  className,
  onClick,
  disabled,
  isLoading,
  type = 'button',
  'aria-label': ariaLabel,
}: ButtonProps) {
  const isDisabled = disabled || isLoading

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      aria-label={ariaLabel}
      aria-busy={isLoading ? 'true' : undefined}
      className={clsx(
        // Base
        'inline-flex items-center justify-center gap-2.5 h-9 px-3 py-2.5',
        'rounded-[5px] font-semibold text-sm',
        'transition-shadow duration-150 cursor-pointer',
        // Variant
        variantClasses[variant],
        // Hover: sombra — nunca muda cor (frontend.md)
        'hover:shadow-[0_1px_3px_1px_rgba(0,0,0,0.15)]',
        // Focus
        'focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1',
        // Disabled
        isDisabled && 'opacity-50 cursor-not-allowed pointer-events-none',
        className,
      )}
    >
      {isLoading ? (
        <>
          <svg
            aria-hidden="true"
            className="animate-spin h-4 w-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v8H4z"
            />
          </svg>
          {children && <span>{children}</span>}
        </>
      ) : (
        <>
          {icon && <span aria-hidden="true">{icon}</span>}
          {children && <span>{children}</span>}
        </>
      )}
    </button>
  )
}
