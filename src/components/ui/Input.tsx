import { forwardRef } from 'react'
import { Input as DsInput } from '@migrate/design-system'

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string
  hint?: string
  error?: string
  required?: boolean
  className?: string
}

/**
 * Campo de entrada — wrapper fino sobre o `Input` do `@migrate/design-system`,
 * preservando a assinatura local (`label`, `hint`, `error`, `required`, ref via RHF).
 * Id gerado internamente pelo DS via `useId()` quando `id` não é informado
 * (AP-FRONTEND-003 — elimina colisão de id entre labels iguais).
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(props, ref) {
  return <DsInput ref={ref} {...props} />
})
