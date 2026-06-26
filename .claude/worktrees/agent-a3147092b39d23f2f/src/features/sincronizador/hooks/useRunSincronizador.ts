import { useMutation, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { useToast } from '../../../components/ui/Toast'
import { handleApiError } from '../../../utils/handleApiError'
import { runSincronizador } from '../services/sincronizadorService'

/**
 * Hook para disparar sincronização manual.
 * 409 → toast de aviso (sincronização já em andamento).
 * Sucesso → invalida status e logs para atualização imediata.
 */
export function useRunSincronizador() {
  const queryClient = useQueryClient()
  const toast = useToast()

  return useMutation({
    mutationFn: runSincronizador,
    onSuccess: () => {
      toast.info('Sincronização iniciada.')
      queryClient.invalidateQueries({ queryKey: ['sincronizador-status'] })
      queryClient.invalidateQueries({ queryKey: ['sincronizador-logs'] })
    },
    onError: (error: unknown) => {
      const is409 = isAxiosError(error) && error.response?.status === 409
      const message = is409
        ? 'Sincronização já em andamento.'
        : handleApiError(error)
      toast.error(message)
    },
  })
}
