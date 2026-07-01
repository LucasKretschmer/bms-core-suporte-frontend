import { useMutation } from '@tanstack/react-query'
import { useToast } from '../../../components/ui/Toast'
import { handleApiError } from '../../../utils/handleApiError'
import { syncEmpresas } from '../services/sincronizadorService'

/**
 * Hook para sincronizar empresas do HubSpot (081) — processo dedicado,
 * separado do sync de tickets. Síncrono: aguarda o resultado da chamada.
 * Sucesso → toast com resumo (criadas/atualizadas/removidas).
 * Erro → toast de erro genérico.
 */
export function useSyncEmpresas() {
  const toast = useToast()

  return useMutation({
    mutationFn: syncEmpresas,
    onSuccess: (result) => {
      toast.success(
        `Empresas: ${result.criadas} criada(s), ${result.atualizadas} atualizada(s), ${result.desativadas} removida(s).`,
      )
    },
    onError: (error: unknown) => {
      toast.error(handleApiError(error))
    },
  })
}
