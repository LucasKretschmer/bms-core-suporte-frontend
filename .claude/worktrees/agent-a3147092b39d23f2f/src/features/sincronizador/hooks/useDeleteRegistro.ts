import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '../../../components/ui/Toast'
import { handleApiError } from '../../../utils/handleApiError'
import { deleteRegistro } from '../services/sincronizadorService'
import type { RegistroTipo } from '../types/sincronizador'

/**
 * Hook para soft-delete de registro (ticket ou projeto).
 * Sucesso → toast, invalida query de busca, chama callback opcional.
 * Erro → toast de erro.
 */
export function useDeleteRegistro(onSuccess?: () => void) {
  const queryClient = useQueryClient()
  const toast = useToast()

  return useMutation({
    mutationFn: ({ tipo, hubspotId }: { tipo: RegistroTipo; hubspotId: string }) =>
      deleteRegistro(tipo, hubspotId),
    onSuccess: () => {
      toast.success('Registro desativado com sucesso.')
      queryClient.invalidateQueries({ queryKey: ['sincronizador-registros'] })
      onSuccess?.()
    },
    onError: (error: unknown) => {
      toast.error(handleApiError(error))
    },
  })
}
