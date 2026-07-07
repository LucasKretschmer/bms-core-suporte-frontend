import { forwardRef } from 'react'
import type { ReactNode } from 'react'
import { Button as DsButton, cn } from '@migrate/design-system'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'

type ButtonProps = {
  children?: ReactNode
  variant?: ButtonVariant
  icon?: ReactNode
  className?: string
  onClick?: () => void
  disabled?: boolean
  isLoading?: boolean
  type?: 'button' | 'submit' | 'reset'
  'aria-label'?: string
}

/**
 * `variant` local → DS `Button`: `primary`/`secondary` mapeiam direto; `ghost` e `danger`
 * não existem no DS (G8/G11 — ds-gaps.md) e são simulados por cima da variante DS mais
 * próxima usando tokens (nunca hex hardcoded).
 */
const dsVariantMap: Record<ButtonVariant, 'primary' | 'secondary'> = {
  primary: 'primary',
  secondary: 'secondary',
  ghost: 'secondary',
  danger: 'primary',
}

// ghost: ação discreta sobre fundo claro — hover por tinta de superfície (bg-surface-hover),
// não pela sombra do secondary (ficaria estranha sem borda visível).
const ghostClassName = cn(
  'border-transparent bg-transparent text-foreground',
  'hover:border-transparent hover:bg-surface-hover hover:text-foreground hover:shadow-none',
  'focus-visible:border-transparent',
)

// danger: ação destrutiva (ConfirmDialog) — fundo do token funcional --color-error,
// hover mais escuro (brightness, sem hex novo) + hover=sombra (nunca só troca de cor).
const dangerClassName = cn(
  'bg-error text-white hover:bg-error hover:brightness-90 hover:shadow-hover',
  'focus-visible:bg-error focus-visible:brightness-90 focus-visible:shadow-hover',
)

const variantClassName: Partial<Record<ButtonVariant, string>> = {
  ghost: ghostClassName,
  danger: dangerClassName,
}

/**
 * Botão do Design System Migrate — wrapper fino sobre o `Button` do
 * `@migrate/design-system`, preservando a assinatura local (`icon`, `variant` incl.
 * `ghost`/`danger`, `onClick: () => void`) já usada em toda a app.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    children,
    variant = 'primary',
    icon,
    className,
    onClick,
    disabled,
    isLoading,
    type = 'button',
    'aria-label': ariaLabel,
  },
  ref,
) {
  return (
    <DsButton
      ref={ref}
      type={type}
      variant={dsVariantMap[variant]}
      leftIcon={icon}
      // O DS só bloqueia o clique via JS quando isLoading (mantém o <button> "habilitado"
      // visualmente/para AT). O contrato local sempre desabilitou de fato durante o loading
      // (dimmed + fora do fluxo de tab) — preservado aqui para não mudar UX/a11y das telas.
      disabled={disabled || isLoading}
      isLoading={isLoading}
      aria-label={ariaLabel}
      onClick={() => onClick?.()}
      className={cn(variantClassName[variant], className)}
    >
      {children}
    </DsButton>
  )
})
