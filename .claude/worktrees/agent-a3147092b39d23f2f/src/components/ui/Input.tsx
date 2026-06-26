import { clsx } from 'clsx'
import { forwardRef } from 'react'

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string
  hint?: string
  error?: string
  required?: boolean
  className?: string
}

/**
 * Campo de entrada do Design System BMS.
 * h-36px, canto 5px, focus com contorno #666, label com asterisco antes.
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, required, className, id, ...rest },
  ref,
) {
  const inputId = id ?? (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined)

  return (
    <div className="flex flex-col space-y-0.5">
      {label && (
        <label
          htmlFor={inputId}
          className="text-xs lg:text-sm font-normal text-foreground"
        >
          {required && <span className="text-error-fg mr-1" aria-hidden="true">*</span>}
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        required={required}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
        className={clsx(
          'h-9 rounded-[5px] border border-border px-3 py-2.5',
          'text-sm text-foreground placeholder:text-foreground/40',
          'bg-card',
          'transition-shadow duration-150',
          'outline-none focus:border-[#666] focus:ring-0',
          error && 'border-error-fg',
          className,
        )}
        {...rest}
      />
      {error && (
        <p id={`${inputId}-error`} className="text-xs text-error-fg" role="alert">
          {error}
        </p>
      )}
      {hint && !error && (
        <p id={`${inputId}-hint`} className="text-xs text-foreground/50">
          {hint}
        </p>
      )}
    </div>
  )
})
