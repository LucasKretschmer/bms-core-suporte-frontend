import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '../../../components/ui/Toast'
import { handleApiError } from '../../../utils/handleApiError'
import { getCategoryMutationErrorMessage } from '../utils/categoryErrorMessage'
import {
  createServiceCategory,
  deleteServiceCategory,
  toggleServiceCategory,
  updateServiceCategory,
} from '../services/serviceCategoriesService'
import type {
  EditCategoryFormValues,
  NewCategoryFormValues,
} from '../types/serviceCategory'
import { SERVICE_CATEGORIES_QUERY_KEY } from './useServiceCategories'

/**
 * Chaves de query que dependem da lista de categorias — levantadas por varredura
 * (`grep service-categories|category-options` em `src/`), não por memória:
 *
 * | Chave                                          | Onde                                                       |
 * |------------------------------------------------|------------------------------------------------------------|
 * | `['service-categories', {includeInactive:true}]` | esta tela — `hooks/useServiceCategories.ts:4`            |
 * | `['service-categories']`                        | filtro do relatório de Apontamentos — `features/reports/appointments/index.tsx:168` |
 * | `['category-options-active']`                    | combo do modal de apontamento — `features/ticket-detail/hooks/useModalOptions.ts:20` |
 *
 * ⚠️ Invalidar a chave da tela **não** alcança as outras duas: o casamento do TanStack
 * Query é por **prefixo**, e `['service-categories']` não começa com
 * `['service-categories', {includeInactive:true}]` — é o contrário. Por isso a lista
 * usa o PREFIXO `['service-categories']` (que cobre as duas primeiras) mais a chave
 * própria do combo. Antes de 123/FE-2 renomear/criar/desativar deixava o filtro de
 * Apontamentos e o combo do modal exibindo o nome antigo até um reload.
 */
const CHAVES_DEPENDENTES = [
  ['service-categories'] as const,
  ['category-options-active'] as const,
]

/**
 * Mutations de categoria: criar, editar (PUT — nome + flag 133), alternar ativação
 * (PATCH) e excluir.
 * Toda mutation invalida as listas dependentes no sucesso e dispara toast.
 */
export function useCategoryMutations() {
  const queryClient = useQueryClient()
  const toast = useToast()

  function invalidate() {
    // Mantida explicitamente além do prefixo: se a chave desta tela deixar de começar
    // por 'service-categories', a invalidação da própria tela não some junto.
    queryClient.invalidateQueries({ queryKey: SERVICE_CATEGORIES_QUERY_KEY })
    for (const queryKey of CHAVES_DEPENDENTES) {
      queryClient.invalidateQueries({ queryKey })
    }
  }

  const create = useMutation({
    // 133: a flag viaja SEMPRE explícita, do form ao body (`serviceCategoriesService`).
    mutationFn: ({ nome, forcesBillableOutsidePlan }: NewCategoryFormValues) =>
      createServiceCategory(nome, forcesBillableOutsidePlan),
    onSuccess: () => {
      toast.success('Categoria adicionada.')
      invalidate()
    },
    // 409 (nome duplicado) também acontece na criação — mesma mensagem acionável.
    onError: (error: unknown) => toast.error(getCategoryMutationErrorMessage(error)),
  })

  const update = useMutation({
    mutationFn: ({
      id,
      nome,
      forcesBillableOutsidePlan,
    }: { id: number } & EditCategoryFormValues) =>
      updateServiceCategory(id, nome, forcesBillableOutsidePlan),
    onSuccess: () => {
      // 133: o PUT deixou de ser só "renomear" — o toast não pode continuar afirmando
      // uma coisa que o request não faz mais sozinho (`AP-FRONTEND-022`).
      toast.success('Categoria atualizada.')
      invalidate()
    },
    onError: (error: unknown) => toast.error(getCategoryMutationErrorMessage(error)),
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

  return { create, update, toggleActive, remove }
}
