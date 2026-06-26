import { describe, expect, it, vi, beforeEach } from 'vitest'

// Mock da instância centralizada do Axios
vi.mock('../../../../services/api', () => ({
  api: {
    get: vi.fn(),
  },
}))

import { api } from '../../../../services/api'
import { getMetricRows } from './metricsService'
import type { PaginatedResponse } from '../../../../types/api'
import type { TicketRowDto } from '../types/metrics'

const EMPTY_PAGE: PaginatedResponse<TicketRowDto> = {
  items: [],
  totalCount: 0,
  page: 1,
  pageSize: 25,
  totalPages: 0,
}

describe('getMetricRows', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('chama GET /api/v1/metrics/rows com o metric e os filtros da tela', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: EMPTY_PAGE })

    await getMetricRows({
      metric: 'tickets-reabertos',
      scope: 'management:suporte',
      from: '2026-06-01',
      to: '2026-06-26',
      clientId: '42',
      page: 1,
      pageSize: 25,
      sortBy: 'reabertoem',
      sortDirection: 'desc',
    })

    expect(api.get).toHaveBeenCalledWith(
      '/api/v1/metrics/rows',
      expect.objectContaining({
        params: expect.objectContaining({
          metric: 'tickets-reabertos',
          scope: 'management:suporte',
          from: '2026-06-01',
          to: '2026-06-26',
          clientId: '42',
          page: 1,
          pageSize: 25,
          sortBy: 'reabertoem',
          sortDirection: 'desc',
        }),
      }),
    )
  })

  it('repassa params específicos (stageId, sla)', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: EMPTY_PAGE })

    await getMetricRows({
      metric: 'tickets-sla',
      scope: 'global',
      from: null,
      to: null,
      clientId: null,
      stageId: null,
      sla: 'on',
      page: 1,
      pageSize: 50,
    })

    const callParams = vi.mocked(api.get).mock.calls[0][1]?.params as Record<string, unknown>
    expect(callParams.metric).toBe('tickets-sla')
    expect(callParams.sla).toBe('on')
  })

  it('remove params null/undefined/vazio antes de enviar (cleanParams)', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: EMPTY_PAGE })

    await getMetricRows({
      metric: 'tickets-backlog',
      scope: 'global',
      from: null,
      to: null,
      clientId: null,
      stageId: null,
      sla: null,
      page: 1,
      pageSize: 25,
    })

    const callParams = vi.mocked(api.get).mock.calls[0][1]?.params as Record<string, unknown>
    expect('from' in callParams).toBe(false)
    expect('clientId' in callParams).toBe(false)
    expect('sla' in callParams).toBe(false)
    expect('stageId' in callParams).toBe(false)
    expect(callParams.metric).toBe('tickets-backlog')
  })

  it('retorna o PaginatedResponse do backend', async () => {
    const row: TicketRowDto = {
      ticketId: 7,
      hubspotTicketId: '999',
      assunto: 'Erro no login',
      clienteNome: 'ACME',
      equipe: 'Suporte N1',
      ownerNome: 'Fulano',
      status: 'Em andamento',
      hsCriadoEm: '2026-06-10',
      fechadoEm: null,
      reabertoEm: '2026-06-20',
      frHoras: null,
      frHorasUteis: null,
      frSla: null,
      resHoras: null,
      resHorasUteis: null,
      csat: null,
      isOneTouch: null,
      hubspotUrl: null,
    }
    vi.mocked(api.get).mockResolvedValueOnce({
      data: { items: [row], totalCount: 1, page: 1, pageSize: 25, totalPages: 1 },
    })

    const result = await getMetricRows({
      metric: 'tickets-reabertos',
      page: 1,
      pageSize: 25,
    })

    expect(result.items).toHaveLength(1)
    expect(result.items[0].ticketId).toBe(7)
    expect(result.totalCount).toBe(1)
  })
})
