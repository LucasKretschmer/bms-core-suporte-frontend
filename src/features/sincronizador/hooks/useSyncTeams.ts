import { useMutation } from '@tanstack/react-query'
import { useToast } from '../../../components/ui/Toast'
import { handleApiError } from '../../../utils/handleApiError'
import { syncTeams } from '../services/sincronizadorService'

/**
 * Hook para sincronizar owners e equipes do HubSpot.
 * Sucesso → toast com contadores de processados.
 * Erro → toast de erro genérico.
 */
export function useSyncTeams() {
  const toast = useToast()

  return useMutation({
    mutationFn: syncTeams,
    onSuccess: (result) => {
      toast.success(
        `Equipes sincronizadas: ${result.ownersProcessed} owner(s) e ${result.teamsProcessed} time(s) processados.`,
      )
    },
    onError: (error: unknown) => {
      toast.error(handleApiError(error))
    },
  })
}
