import { useMutation } from '@tanstack/react-query'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { useAuth } from '../../../hooks/useAuth'
import { useToast } from '../../../components/ui/Toast'
import { handleApiError } from '../../../utils/handleApiError'

/**
 * Hook de login.
 * Usa useMutation do TanStack Query.
 * Sucesso: redireciona para ?redirect ou /.
 * Erro: toast de erro (nunca inline — evitar enumeração de credenciais).
 */
export function useLogin() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()

  // Tenta pegar o redirect da URL
  let redirectTo = '/'
  try {
    const search = useSearch({ strict: false }) as { redirect?: string }
    if (search.redirect && search.redirect.startsWith('/')) {
      redirectTo = search.redirect
    }
  } catch {
    // useSearch pode falhar fora de contexto de rota
  }

  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      login(email, password),
    onSuccess: () => {
      navigate({ to: redirectTo })
    },
    onError: (error: unknown) => {
      const message = handleApiError(error)
      toast.error(message)
    },
  })
}
