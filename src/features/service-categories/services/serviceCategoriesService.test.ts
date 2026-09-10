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

const sample: ServiceCategoryDto = { id: 1, nome: 'Consultoria', isActive: true }

/**
 * 133 — **JSON cru** da resposta, como o wire entrega (armadilha 4 do PRD: chave
 * divergente entre backend e frontend passa silenciosa; DTO em memória não prova nada).
 * Os três itens são propositalmente diferentes: `true`, `false` **declarado** e a chave
 * **ausente** (backend anterior à 133). Cardinalidade assimétrica de propósito.
 */
const WIRE_CATEGORIAS = [
  { id: 1, nome: 'Consultoria', isActive: true, forcesBillableOutsidePlan: true },
  { id: 2, nome: 'Suporte', isActive: true, forcesBillableOutsidePlan: false },
  { id: 3, nome: 'Legado', isActive: true },
]

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

    it('a chave forcesBillableOutsidePlan sobrevive ao service — true, false e AUSENTE', async () => {
      // Vermelho se alguém puser projeção campo-a-campo no service (o campo sumiria), se a
      // chave do wire divergir (`forca…` × `forces…`), ou se alguém "normalizar" a ausência
      // para `false` — ausente ≠ false declarado pelo servidor (`AP-FRONTEND-021`).
      vi.mocked(api.get).mockResolvedValueOnce({ data: { data: WIRE_CATEGORIAS } })

      const result = await listServiceCategories(true)

      expect(result[0].forcesBillableOutsidePlan).toBe(true)
      expect(result[1].forcesBillableOutsidePlan).toBe(false)
      expect(result[2]).not.toHaveProperty('forcesBillableOutsidePlan')
      // Companheira positiva: o resto do DTO não regrediu junto.
      expect(result.map((c) => c.nome)).toEqual(['Consultoria', 'Suporte', 'Legado'])
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
    it('faz POST com { nome, forcesBillableOutsidePlan } e desempacota o envelope', async () => {
      vi.mocked(api.post).mockResolvedValueOnce({
        data: { data: { ...sample, forcesBillableOutsidePlan: true } },
      })

      const result = await createServiceCategory('Consultoria', true)

      // Objeto EXATO: vermelho se a chave for renomeada, se o 2º argumento for ignorado,
      // ou se aparecer campo a mais no body.
      expect(api.post).toHaveBeenCalledWith('/api/v1/service-categories', {
        nome: 'Consultoria',
        forcesBillableOutsidePlan: true,
      })
      expect(result.forcesBillableOutsidePlan).toBe(true)
    })

    it('POST com a flag FALSE leva a chave PRESENTE no body — nunca omitida', async () => {
      // Companheira do caso `true`, e o assert que reprova spread condicional
      // (`...(forca && { forcesBillableOutsidePlan: forca })`): com o spread, o caso `true`
      // continuaria verde e só este ficaria vermelho.
      vi.mocked(api.post).mockResolvedValueOnce({ data: { data: sample } })

      await createServiceCategory('Suporte', false)

      const body = vi.mocked(api.post).mock.calls[0][1]
      expect(body).toHaveProperty('forcesBillableOutsidePlan', false)
      expect(body).toEqual({ nome: 'Suporte', forcesBillableOutsidePlan: false })
    })
  })

  describe('toggleServiceCategory', () => {
    it('faz PATCH no id com { isActive } e desempacota o envelope', async () => {
      vi.mocked(api.patch).mockResolvedValueOnce({ data: { data: { ...sample, isActive: false } } })

      const result = await toggleServiceCategory(1, false)

      expect(api.patch).toHaveBeenCalledWith('/api/v1/service-categories/1', { isActive: false })
      expect(result.isActive).toBe(false)
    })

    it('reativa enviando isActive=true', async () => {
      vi.mocked(api.patch).mockResolvedValueOnce({ data: { data: { ...sample, isActive: true } } })

      const result = await toggleServiceCategory(1, true)

      expect(api.patch).toHaveBeenCalledWith('/api/v1/service-categories/1', { isActive: true })
      expect(result.isActive).toBe(true)
    })
  })

  describe('updateServiceCategory (nome + flag 133)', () => {
    it('faz PUT no id com { nome, forcesBillableOutsidePlan } e desempacota o envelope', async () => {
      vi.mocked(api.put).mockResolvedValueOnce({
        data: { data: { ...sample, nome: 'Novo nome', forcesBillableOutsidePlan: true } },
      })

      const result = await updateServiceCategory(1, 'Novo nome', true)

      expect(api.put).toHaveBeenCalledWith('/api/v1/service-categories/1', {
        nome: 'Novo nome',
        forcesBillableOutsidePlan: true,
      })
      expect(result.nome).toBe('Novo nome')
    })

    /**
     * O `bool?` do servidor ("null/ausente = NÃO ALTERAR", `arquitetura.md` §6.1) é rede
     * de proteção do SERVIDOR, não licença para o painel omitir. Se o body sair sem a
     * chave no caso `false`, o servidor **preserva a flag ligada** e o usuário que
     * desligou o switch vê a mudança sumir sem erro nenhum.
     *
     * O que deixa vermelho: exatamente o spread condicional. O caso `true` acima passaria
     * com ele; este não.
     */
    it('PUT com a flag FALSE leva a chave PRESENTE — reprova spread condicional', async () => {
      vi.mocked(api.put).mockResolvedValueOnce({
        data: { data: { ...sample, forcesBillableOutsidePlan: false } },
      })

      await updateServiceCategory(1, 'Novo nome', false)

      const body = vi.mocked(api.put).mock.calls[0][1]
      expect(body).toHaveProperty('forcesBillableOutsidePlan', false)
      expect(body).toEqual({ nome: 'Novo nome', forcesBillableOutsidePlan: false })
    })

    it('o PATCH de ativação NÃO ganhou a flag (segunda via de escrita é proibida)', async () => {
      // Vermelho se alguém "aproveitar" o PATCH para gravar a flag também: duas vias de
      // escrita para o mesmo campo é fábrica de divergência (`arquitetura.md` §4.3).
      vi.mocked(api.patch).mockResolvedValueOnce({ data: { data: sample } })

      await toggleServiceCategory(1, true)

      expect(vi.mocked(api.patch).mock.calls[0][1]).toEqual({ isActive: true })
    })
  })

  describe('deleteServiceCategory', () => {
    it('faz DELETE no id', async () => {
      vi.mocked(api.delete).mockResolvedValueOnce({ status: 204 })
      await deleteServiceCategory(1)
      expect(api.delete).toHaveBeenCalledWith('/api/v1/service-categories/1')
    })
  })
})
