import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../services/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}))

import { api } from '../../../services/api'
import {
  createServiceCategory,
  deleteServiceCategory,
  listServiceCategories,
  toggleServiceCategory,
  updateServiceCategory,
} from './serviceCategoriesService'
import type { ServiceCategoryDto } from '../types/serviceCategory'

const sample: ServiceCategoryDto = { id: 'c-1', nome: 'Consultoria', isActive: true }

describe('serviceCategoriesService', () => {
  beforeEach(() => vi.clearAllMocks())

  describe('listServiceCategories', () => {
    it('desempacota ApiResponse { data } e passa includeInactive', async () => {
      vi.mocked(api.get).mockResolvedValueOnce({ data: { data: [sample] } })

      const result = await listServiceCategories(true)

      expect(api.get).toHaveBeenCalledWith('/api/v1/service-categories', {
        params: { includeInactive: true },
      })
      expect(result).toEqual([sample])
    })

    it('default inclui inativas (includeInactive=true)', async () => {
      vi.mocked(api.get).mockResolvedValueOnce({ data: { data: [] } })
      await listServiceCategories()
      expect(api.get).toHaveBeenCalledWith('/api/v1/service-categories', {
        params: { includeInactive: true },
      })
    })
  })

  describe('createServiceCategory', () => {
    it('faz POST com { nome } e desempacota o envelope', async () => {
      vi.mocked(api.post).mockResolvedValueOnce({ data: { data: sample } })

      const result = await createServiceCategory('Consultoria')

      expect(api.post).toHaveBeenCalledWith('/api/v1/service-categories', { nome: 'Consultoria' })
      expect(result).toEqual(sample)
    })
  })

  describe('toggleServiceCategory', () => {
    it('faz PATCH no id com { isActive } e desempacota o envelope', async () => {
      vi.mocked(api.patch).mockResolvedValueOnce({ data: { data: { ...sample, isActive: false } } })

      const result = await toggleServiceCategory('c-1', false)

      expect(api.patch).toHaveBeenCalledWith('/api/v1/service-categories/c-1', { isActive: false })
      expect(result.isActive).toBe(false)
    })

    it('reativa enviando isActive=true', async () => {
      vi.mocked(api.patch).mockResolvedValueOnce({ data: { data: { ...sample, isActive: true } } })

      const result = await toggleServiceCategory('c-1', true)

      expect(api.patch).toHaveBeenCalledWith('/api/v1/service-categories/c-1', { isActive: true })
      expect(result.isActive).toBe(true)
    })
  })

  describe('updateServiceCategory (renomear)', () => {
    it('faz PUT no id com { nome } e desempacota o envelope', async () => {
      vi.mocked(api.put).mockResolvedValueOnce({ data: { data: { ...sample, nome: 'Novo nome' } } })

      const result = await updateServiceCategory('c-1', 'Novo nome')

      expect(api.put).toHaveBeenCalledWith('/api/v1/service-categories/c-1', { nome: 'Novo nome' })
      expect(result.nome).toBe('Novo nome')
    })
  })

  describe('deleteServiceCategory', () => {
    it('faz DELETE no id', async () => {
      vi.mocked(api.delete).mockResolvedValueOnce({ status: 204 })
      await deleteServiceCategory('c-1')
      expect(api.delete).toHaveBeenCalledWith('/api/v1/service-categories/c-1')
    })
  })
})
