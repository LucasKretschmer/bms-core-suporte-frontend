import { QueryClient } from '@tanstack/react-query'

/**
 * Instância singleton do QueryClient.
 *
 * Extraída de main.tsx para fonte única — permite que o logout
 * (AuthContext) limpe o cache do usuário anterior via `queryClient.clear()`
 * sem prop-drilling nem import circular.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000, // 30 segundos
    },
  },
})
