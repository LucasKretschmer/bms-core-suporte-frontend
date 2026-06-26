import { useQuery } from '@tanstack/react-query'
import { listServiceCategories } from '../services/serviceCategoriesService'

export const SERVICE_CATEGORIES_QUERY_KEY = ['service-categories', { includeInactive: true }] as const

/**
 * Lista categorias de atendimento (inclui inativas — toggle na tela).
 */
export function useServiceCategories() {
  return useQuery({
    queryKey: SERVICE_CATEGORIES_QUERY_KEY,
    queryFn: () => listServiceCategories(true),
  })
}
