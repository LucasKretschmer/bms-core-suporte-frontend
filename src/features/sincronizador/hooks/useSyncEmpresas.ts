import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '../../../components/ui/Toast'
import { handleApiError } from '../../../utils/handleApiError'
import { syncEmpresas } from '../services/sincronizadorService'

/**
 * Hook para sincronizar empresas do HubSpot (081) — processo dedicado,
 * separado do sync de tickets. Síncrono: aguarda o resultado da chamada.
 * Sucesso → toast com resumo (criadas/atualizadas/removidas) + invalida os
 * logs do sincronizador (088) para a nova linha do histórico aparecer.
 * Erro → toast de erro genérico.
 */
export function useSyncEmpresas() {
  const toast = useToast()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: syncEmpresas,
    onSuccess: (result) => {
      toast.success(
        `Empresas: ${result.criadas} criada(s), ${result.atualizadas} atualizada(s), ${result.desativadas} removida(s).`,
      )
      // A rodada de empresas grava um log (088) — refrescar histórico e status.
      void queryClient.invalidateQueries({ queryKey: ['sincronizador-logs'] })
      void queryClient.invalidateQueries({ queryKey: ['sincronizador-status'] })
    },
    onError: (error: unknown) => {
      toast.error(handleApiError(error))
    },
  })
}
