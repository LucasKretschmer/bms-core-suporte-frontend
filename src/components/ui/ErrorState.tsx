import { ErrorState as DsErrorState } from '@migrate/design-system'

type ErrorStateProps = {
  message?: string
  onRetry?: () => void
  className?: string
}

/**
 * Estado de erro com botão de retry. Nunca expor detalhes técnicos ao usuário.
 *
 * Wrapper sobre o DS `ErrorState`. O default de mensagem do app difere do
 * default do DS ("Ocorreu um erro inesperado.") — declaramos o default aqui
 * explicitamente para não mudar a mensagem que já aparece em todas as telas
 * sem `message` customizada.
 */
export function ErrorState({
  message = 'Ocorreu um erro ao carregar os dados.',
  onRetry,
  className,
}: ErrorStateProps) {
  return <DsErrorState message={message} onRetry={onRetry} className={className} />
}
