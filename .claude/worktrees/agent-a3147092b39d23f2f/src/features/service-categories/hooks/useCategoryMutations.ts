import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '../../../components/ui/Toast'
import { handleApiError } from '../../../utils/handleApiError'
import {
  createServiceCategory,
  deleteServiceCategory,
  toggleServiceCategory,
} from '../services/serviceCategoriesService'
import { SERVICE_CATEGORIES_QUERY_KEY } from './useServiceCategories'

/**
 * Mutations de categoria: criar, alternar ativação (PATCH) e excluir.
 * Toda mutation invalida a lista no sucesso e dispara toast.
 */
export function useCategoryMutations() {
  const queryClient = useQueryClient()
  const toast = useToast()

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: SERVICE_CATEGORIES_QUERY_KEY })
  }

  const create = useMutation({
    mutationFn: (nome: string) => createServiceCategory(nome),
    onSuccess: () => {
      toast.success('Categoria adicionada.')
      invalidate()
    },
    onError: (error: unknown) => toast.error(handleApiError(error)),
  })

  const toggleActive = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      toggleServiceCategory(id, isActive),
    onSuccess: (_data, variables) => {
      toast.success(variables.isActive ? 'Categoria ativada.' : 'Categoria desativada.')
      invalidate()
    },
    onError: (error: unknown) => toast.error(handleApiError(error)),
  })

  const remove = useMutation({
    mutationFn: (id: number) => deleteServiceCategory(id),
    onSuccess: () => {
      toast.success('Categoria removida.')
      invalidate()
    },
    onError: (error: unknown) => toast.error(handleApiError(error)),
  })

  return { create, toggleActive, remove }
}
