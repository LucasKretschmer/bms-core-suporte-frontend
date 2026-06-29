import { describe, expect, it, vi, beforeEach } from 'vitest'

// Mock da instância centralizada do Axios
vi.mock('../../../services/api', () => ({
  api: {
    get: vi.fn(),
  },
}))

import { api } from '../../../services/api'
import { listMovimentacaoDiaria } from './movimentacaoDiariaService'
import type { PaginatedResponse } from '../../../types/api'
import type { MovimentacaoDiariaRowDto } from '../types/movimentacaoDiaria'

const sampleResponse: PaginatedResponse<MovimentacaoDiariaRowDto> = {
  items: [
    {
      id: 1,
      data: '2026-06-29',
      statusBucket: 'emandamento',
      statusLabel: 'Em atendimento (BR)',
      equipeId: 5,
      equipe: 'Relacionamento BR',
      quantidade: 12,
      atualizadoEm: '2026-06-29T13:45:00-03:00',
    },
  ],
  totalCount: 1,
  page: 1,
  pageSize: 25,
  totalPages: 1,
}

describe('listMovimentacaoDiaria', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('chama o endpoint correto e retorna o envelope paginado', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: sampleResponse })

    const result = await listMovimentacaoDiaria({ page: 1, pageSize: 25 })

    expect(api.get).toHaveBeenCalledWith(
      '/api/v1/metrics/movimentacao-diaria',
      expect.objectContaining({ params: expect.any(Object) }),
    )
    expect(result).toEqual(sampleResponse)
    expect(result.items[0].equipe).toBe('Relacionamento BR')
  })

  it('envia filtros/ordenação/paginação preenchidos', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: sampleResponse })

    await listMovimentacaoDiaria({
      scope: 'team:5',
      from: '2026-06-01',
      to: '2026-06-29',
      statusBucket: ['emandamento', 'aberto'],
      equipeId: 5,
      search: 'BR',
      sortBy: 'quantidade',
      sortDirection: 'asc',
      page: 2,
      pageSize: 50,
    })

    const params = vi.mocked(api.get).mock.calls[0][1]?.params as Record<string, unknown>
    expect(params).toMatchObject({
      scope: 'team:5',
      from: '2026-06-01',
      to: '2026-06-29',
      statusBucket: ['emandamento', 'aberto'],
      equipeId: 5,
      search: 'BR',
      sortBy: 'quantidade',
      sortDirection: 'asc',
      page: 2,
      pageSize: 50,
    })
  })

  it('remove null/undefined/vazio e arrays vazios dos params', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: sampleResponse })

    await listMovimentacaoDiaria({
      scope: 'global',
      from: null,
      to: undefined,
      statusBucket: [],
      equipeId: null,
      search: '',
      sortBy: null,
      page: 1,
      pageSize: 25,
    })

    const params = vi.mocked(api.get).mock.calls[0][1]?.params as Record<string, unknown>
    expect(params).toEqual({ scope: 'global', page: 1, pageSize: 25 })
    expect(params).not.toHaveProperty('from')
    expect(params).not.toHaveProperty('to')
    expect(params).not.toHaveProperty('statusBucket')
    expect(params).not.toHaveProperty('equipeId')
    expect(params).not.toHaveProperty('search')
    expect(params).not.toHaveProperty('sortBy')
  })
})
