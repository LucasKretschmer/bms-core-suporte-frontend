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
  createSupportPlan,
  listCalendarOptions,
  listSupportPlans,
  listUnmatchedPlans,
  updateSupportPlan,
} from './supportPlansService'
import type { SupportPlanDto, SupportPlanRequest, UnmatchedPlanDto } from '../types/supportPlan'

const plano: SupportPlanDto = {
  id: 7,
  nome: 'Support Pro',
  horasMes: 40,
  precoHoraExtra: null,
  moeda: 'BRL',
  isActive: true,
  hubspotValor: 'plano_pro',
  slaPrimeiroAtendimentoMinutos: 20,
  slaIsento: false,
  calendarioId: 1,
  clientesVinculados: 3,
}

const payload: SupportPlanRequest = {
  nome: 'Support Pro',
  horasMes: 40,
  precoHoraExtra: null,
  moeda: 'BRL',
  hubspotValor: 'plano_pro',
  slaPrimeiroAtendimentoMinutos: 20,
  slaIsento: false,
  calendarioId: 1,
}

describe('supportPlansService', () => {
  beforeEach(() => vi.clearAllMocks())

  it('listSupportPlans chama GET /api/v1/support-plans e desempacota { data }', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: { data: [plano] } })

    const result = await listSupportPlans()

    expect(api.get).toHaveBeenCalledWith('/api/v1/support-plans')
    expect(result).toEqual([plano])
  })

  it('listSupportPlans NÃO envia params — nenhum filtro em array nesta tela (R-7)', () => {
    // R-7: filtro que vira array exige `paramsSerializer { indexes: null }` para o
    // ASP.NET bindar. A instância `api` já o tem (`services/api.ts:41`); este assert
    // documenta que hoje a chamada é sem parâmetro, para que um filtro futuro seja
    // decisão consciente — e não um `?ids[]=` acidental que o backend ignora.
    vi.mocked(api.get).mockResolvedValueOnce({ data: { data: [] } })
    void listSupportPlans()
    expect(vi.mocked(api.get).mock.calls[0]).toHaveLength(1)
  })

  it('listUnmatchedPlans chama GET /api/v1/support-plans/unmatched', async () => {
    const itens: UnmatchedPlanDto[] = [
      { valorHubspot: 'Support Gold', clientesAfetados: 14, exemploClienteId: 42 },
    ]
    vi.mocked(api.get).mockResolvedValueOnce({ data: { data: itens } })

    const result = await listUnmatchedPlans()

    expect(api.get).toHaveBeenCalledWith('/api/v1/support-plans/unmatched')
    expect(result).toEqual(itens)
  })

  it('createSupportPlan faz POST com o payload tipado e desempacota o envelope', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ data: { data: plano } })

    const result = await createSupportPlan(payload)

    expect(api.post).toHaveBeenCalledWith('/api/v1/support-plans', payload)
    expect(result).toEqual(plano)
  })

  it('updateSupportPlan faz PUT no id inteiro da rota ({id:int})', async () => {
    vi.mocked(api.put).mockResolvedValueOnce({ data: { data: plano } })

    await updateSupportPlan(7, payload)

    expect(api.put).toHaveBeenCalledWith('/api/v1/support-plans/7', payload)
  })

  it('o corpo enviado ao PUT tem os ids como NÚMERO no JSON serializado (R-10)', async () => {
    vi.mocked(api.put).mockResolvedValueOnce({ data: { data: plano } })

    await updateSupportPlan(7, payload)

    const corpoEnviado = vi.mocked(api.put).mock.calls[0]?.[1]
    const wire = JSON.parse(JSON.stringify(corpoEnviado)) as Record<string, unknown>
    expect(typeof wire.calendarioId).toBe('number')
    expect(typeof wire.slaPrimeiroAtendimentoMinutos).toBe('number')
  })

  it('listCalendarOptions chama GET /api/v1/calendars (endpoint da unidade BE-F2F3)', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: { data: [] } })

    await listCalendarOptions()

    expect(api.get).toHaveBeenCalledWith('/api/v1/calendars')
  })
})
