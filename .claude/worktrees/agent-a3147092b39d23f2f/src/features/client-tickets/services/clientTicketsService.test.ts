import { describe, expect, it, vi, beforeEach } from 'vitest'
import { getClientKpis, listClientTickets } from './clientTicketsService'
import { api } from '../../../services/api'

vi.mock('../../../services/api', () => ({
  api: { get: vi.fn() },
}))

const mockedGet = vi.mocked(api.get)

function paginated<T>(items: T[], totalPages = 1) {
  return {
    data: { items, totalCount: items.length, page: 1, pageSize: 200, totalPages },
  }
}

describe('clientTicketsService', () => {
  beforeEach(() => {
    mockedGet.mockReset()
  })

  it("listClientTickets retorna PaginatedResponse cru e monta params com clientId + scope='all' por default", async () => {
    mockedGet.mockResolvedValueOnce(paginated([{ ticketId: 1 }]))
    const result = await listClientTickets({
      clientId: 1,
      search: 'acme',
      page: 1,
      pageSize: 25,
    })
    expect(mockedGet).toHaveBeenCalledWith('/api/v1/reports/tickets', {
      params: expect.objectContaining({
        clientId: 1,
        scope: 'all',
        search: 'acme',
        page: 1,
        pageSize: 25,
      }),
    })
    expect(result.items).toHaveLength(1)
  })

  it('listClientTickets respeita scope explícito (override)', async () => {
    mockedGet.mockResolvedValueOnce(paginated([]))
    await listClientTickets({ clientId: 1, scope: 'mine', page: 1, pageSize: 25 })
    const callParams = mockedGet.mock.calls[0][1]?.params as Record<string, unknown>
    expect(callParams.scope).toBe('mine')
  })

  it('listClientTickets remove params vazios (cleanParams)', async () => {
    mockedGet.mockResolvedValueOnce(paginated([]))
    await listClientTickets({ clientId: 1, search: '', page: 1, pageSize: 25 })
    const callParams = mockedGet.mock.calls[0][1]?.params as Record<string, unknown>
    expect(callParams).not.toHaveProperty('search')
  })

  it('getClientKpis localiza a linha do cliente em plan-consumption', async () => {
    mockedGet.mockResolvedValueOnce(
      paginated([
        { clientId: 2, nomePlano: 'A' },
        { clientId: 1, nomePlano: 'Plano X' },
      ]),
    )
    const result = await getClientKpis(1)
    expect(result).toEqual({ clientId: 1, nomePlano: 'Plano X' })
  })

  it('getClientKpis pagina até achar e retorna null se não houver linha', async () => {
    // Página 1 sem match, página 2 sem match — totalPages 2 → retorna null.
    mockedGet
      .mockResolvedValueOnce(paginated([{ clientId: 3 }], 2))
      .mockResolvedValueOnce(paginated([{ clientId: 4 }], 2))
    const result = await getClientKpis(1)
    expect(result).toBeNull()
    expect(mockedGet).toHaveBeenCalledTimes(2)
  })
})
