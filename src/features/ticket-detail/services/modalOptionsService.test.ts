/**
 * 133/FE-2 · T-FE2-0 — o wire da flag `forcesBillableOutsidePlan` sobrevive ao service.
 *
 * O mock devolve **JSON cru** (não o DTO em memória): o que se prova é a forma real do
 * wire, `arquitetura.md` §6.3. Se alguém puser projeção campo-a-campo no service, ou se a
 * chave divergir do contrato congelado, este arquivo fica vermelho — e o teste irmão do
 * backend também.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { listActiveCategoryOptions } from './modalOptionsService'
import { api } from '../../../services/api'

vi.mock('../../../services/api', () => ({
  api: { get: vi.fn() },
}))

const mockedGet = vi.mocked(api.get)

describe('modalOptionsService · listActiveCategoryOptions (133)', () => {
  beforeEach(() => {
    mockedGet.mockReset()
  })

  it('preserva forcesBillableOutsidePlan `true`, `false`, `null` e ausente — e mantém o endpoint/params', async () => {
    // JSON cru, como o axios entrega. `null` e chave ausente entram de propósito: são os
    // dois modos de "não sei" que um backend anterior à 133 (ou outro serializador)
    // produz, e um teste só com `undefined` passaria também numa implementação errada.
    mockedGet.mockResolvedValueOnce({
      data: {
        data: [
          { id: 2, nome: 'Consultoria', isActive: true, forcesBillableOutsidePlan: true },
          { id: 3, nome: 'Suporte', isActive: true, forcesBillableOutsidePlan: false },
          { id: 4, nome: 'Treinamento', isActive: true, forcesBillableOutsidePlan: null },
          { id: 5, nome: 'Legado', isActive: true },
        ],
        message: 'ok',
      },
    })

    const result = await listActiveCategoryOptions()

    expect(mockedGet).toHaveBeenCalledWith('/api/v1/service-categories', {
      params: { includeInactive: false },
    })
    // Identidade do que chegou, item a item — não só "tem 4".
    expect(result).toEqual([
      { id: 2, nome: 'Consultoria', isActive: true, forcesBillableOutsidePlan: true },
      { id: 3, nome: 'Suporte', isActive: true, forcesBillableOutsidePlan: false },
      { id: 4, nome: 'Treinamento', isActive: true, forcesBillableOutsidePlan: null },
      { id: 5, nome: 'Legado', isActive: true },
    ])
    // A chave ausente continua ausente — o service não inventa `false`.
    expect(Object.prototype.hasOwnProperty.call(result[3], 'forcesBillableOutsidePlan')).toBe(
      false,
    )
  })
})
