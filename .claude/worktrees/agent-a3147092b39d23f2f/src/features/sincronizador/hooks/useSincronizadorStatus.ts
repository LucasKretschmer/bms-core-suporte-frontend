import { useQuery } from '@tanstack/react-query'
import { getSincronizadorStatus } from '../services/sincronizadorService'

/**
 * Hook de status do sincronizador com polling leve a cada 5s.
 * Pausado quando a aba está oculta (refetchIntervalInBackground: false).
 * staleTime: 0 — indicador ao vivo, sempre fresh.
 */
export function useSincronizadorStatus() {
  return useQuery({
    queryKey: ['sincronizador-status'],
    queryFn: getSincronizadorStatus,
    refetchInterval: 5_000,
    refetchIntervalInBackground: false,
    staleTime: 0,
  })
}
