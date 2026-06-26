import { clsx } from 'clsx'
import { Button } from './Button'

type ErrorStateProps = {
  message?: string
  onRetry?: () => void
  className?: string
}

/** Estado de erro com botão de retry. Nunca expor detalhes técnicos ao usuário. */
export function ErrorState({
  message = 'Ocorreu um erro ao carregar os dados.',
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={clsx(
        'flex flex-col items-center justify-center py-16 gap-4 text-center',
        className,
      )}
    >
      <svg
        aria-hidden="true"
        className="h-12 w-12 text-error-fg/50"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.999L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16.001C2.57 17.333 3.532 19 5.072 19z"
        />
      </svg>
      <p className="text-sm text-error-fg">{message}</p>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          Tentar novamente
        </Button>
      )}
    </div>
  )
}
