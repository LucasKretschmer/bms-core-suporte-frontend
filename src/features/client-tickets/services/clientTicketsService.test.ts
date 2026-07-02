import { describe, expect, it, vi, beforeEach } from 'vitest'
import { getClientKpis, listClientTickets, listTicketOwners } from './clientTicketsService'
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

  it('listClientTickets envia teamId e owner como arrays quando preenchidos (070)', async () => {
    mockedGet.mockResolvedValueOnce(paginated([]))
    await listClientTickets({
      clientId: 1,
      status: ['Aberto', 'Em andamento'],
      teamId: [1, 2],
      owner: [7, 9],
      page: 1,
      pageSize: 25,
    })
    const callParams = mockedGet.mock.calls[0][1]?.params as Record<string, unknown>
    expect(callParams.status).toEqual(['Aberto', 'Em andamento'])
    expect(callParams.teamId).toEqual([1, 2])
    expect(callParams.owner).toEqual([7, 9])
  })

  it('listClientTickets omite teamId/owner quando undefined (cleanParams)', async () => {
    mockedGet.mockResolvedValueOnce(paginated([]))
    await listClientTickets({
      clientId: 1,
      teamId: undefined,
      owner: undefined,
      page: 1,
      pageSize: 25,
    })
    const callParams = mockedGet.mock.calls[0][1]?.params as Record<string, unknown>
    expect(callParams).not.toHaveProperty('teamId')
    expect(callParams).not.toHaveProperty('owner')
  })

  it('listClientTickets envia from/to (período) quando preenchidos (095)', async () => {
    mockedGet.mockResolvedValueOnce(paginated([]))
    await listClientTickets({
      clientId: 1,
      from: '2026-06-01',
      to: '2026-06-30',
      page: 1,
      pageSize: 25,
    })
    const callParams = mockedGet.mock.calls[0][1]?.params as Record<string, unknown>
    expect(callParams.from).toBe('2026-06-01')
    expect(callParams.to).toBe('2026-06-30')
  })

  it('listClientTickets omite from/to quando vazios/undefined (cleanParams) (095)', async () => {
    mockedGet.mockResolvedValueOnce(paginated([]))
    await listClientTickets({
      clientId: 1,
      from: '',
      to: undefined,
      page: 1,
      pageSize: 25,
    })
    const callParams = mockedGet.mock.calls[0][1]?.params as Record<string, unknown>
    expect(callParams).not.toHaveProperty('from')
    expect(callParams).not.toHaveProperty('to')
  })

  it('listTicketOwners desempacota data.data do envelope ApiResponse (070)', async () => {
    const owners = [
      { value: 1, label: 'Ana Silva' },
      { value: 2, label: 'Bruno Costa' },
    ]
    mockedGet.mockResolvedValueOnce({ data: { data: owners, message: 'OK' } })
    const result = await listTicketOwners()
    expect(result).toEqual(owners)
    expect(mockedGet).toHaveBeenCalledWith('/api/v1/reports/tickets/owners')
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
