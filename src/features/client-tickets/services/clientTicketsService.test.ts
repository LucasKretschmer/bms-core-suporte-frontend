import { describe, expect, it, vi, beforeEach } from 'vitest'
import { getClientKpis, listClientTickets, listTicketApontadores } from './clientTicketsService'
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

  it('listClientTickets envia teamId e apontadoPor como arrays quando preenchidos', async () => {
    mockedGet.mockResolvedValueOnce(paginated([]))
    await listClientTickets({
      clientId: 1,
      status: ['Aberto', 'Em andamento'],
      teamId: [1, 2],
      apontadoPor: [7, 9],
      page: 1,
      pageSize: 25,
    })
    const callParams = mockedGet.mock.calls[0][1]?.params as Record<string, unknown>
    expect(callParams.status).toEqual(['Aberto', 'Em andamento'])
    expect(callParams.teamId).toEqual([1, 2])
    expect(callParams.apontadoPor).toEqual([7, 9])
    expect(callParams).not.toHaveProperty('owner')
  })

  it('listClientTickets omite teamId/apontadoPor quando undefined (cleanParams)', async () => {
    mockedGet.mockResolvedValueOnce(paginated([]))
    await listClientTickets({
      clientId: 1,
      teamId: undefined,
      apontadoPor: undefined,
      page: 1,
      pageSize: 25,
    })
    const callParams = mockedGet.mock.calls[0][1]?.params as Record<string, unknown>
    expect(callParams).not.toHaveProperty('teamId')
    expect(callParams).not.toHaveProperty('apontadoPor')
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

  it('listTicketApontadores chama /apontadores com scope e clientId e desempacota data.data', async () => {
    const apontadores = [
      { value: 1, label: 'Ana Silva' },
      { value: 2, label: 'Bruno Costa' },
    ]
    mockedGet.mockResolvedValueOnce({ data: { data: apontadores, message: 'OK' } })
    const result = await listTicketApontadores({ scope: 'all', clientId: 42 })
    expect(result).toEqual(apontadores)
    // Sem scope o backend assume 'mine' e o combo mostraria só o usuário logado.
    expect(mockedGet).toHaveBeenCalledWith('/api/v1/reports/tickets/apontadores', {
      params: { scope: 'all', clientId: 42 },
    })
  })

  it('apontadoPor e somenteComApontamento saem no formato que o ASP.NET liga (serializer real)', async () => {
    const actual = await vi.importActual<typeof import('../../../services/api')>(
      '../../../services/api',
    )
    const uri = actual.api.getUri({
      url: '/api/v1/reports/tickets',
      params: { apontadoPor: [7, 9], somenteComApontamento: true },
    })
    expect(uri).toContain('apontadoPor=7&apontadoPor=9')
    expect(uri).toContain('somenteComApontamento=true')
    expect(uri).not.toContain('apontadoPor%5B')
  }, 30_000)

  /**
   * 121/C1 — antes destes testes o contrato afirmado aqui era "getClientKpis manda só
   * paginação", o que DEFENDIA o bug: sem from/to o backend cai no default "mês
   * corrente" e o card do topo ficava cego ao filtro da tela. Agora o período é
   * obrigatório na assinatura e vai na query.
   */
  it('getClientKpis localiza a linha do cliente e ENVIA o período (from/to) ao plan-consumption', async () => {
    mockedGet.mockResolvedValueOnce(
      paginated([
        { clientId: 2, nomePlano: 'A' },
        { clientId: 1, nomePlano: 'Plano X' },
      ]),
    )
    const result = await getClientKpis(1, { from: '2026-06-01', to: '2026-06-30' })
    expect(result).toEqual({ clientId: 1, nomePlano: 'Plano X' })
    expect(mockedGet).toHaveBeenCalledWith('/api/v1/metrics/plan-consumption', {
      params: {
        page: 1,
        pageSize: 200,
        from: '2026-06-01',
        to: '2026-06-30',
      },
    })
  })

  it('getClientKpis omite from/to quando o período é nulo (ramo explícito: backend aplica o default)', async () => {
    mockedGet.mockResolvedValueOnce(paginated([{ clientId: 1 }]))
    await getClientKpis(1, { from: null, to: null })
    const callParams = mockedGet.mock.calls[0][1]?.params as Record<string, unknown>
    expect(callParams).not.toHaveProperty('from')
    expect(callParams).not.toHaveProperty('to')
    expect(callParams).toMatchObject({ page: 1, pageSize: 200 })
  })

  it('getClientKpis devolve os números DO PERÍODO PEDIDO (dois períodos → números distintos)', async () => {
    // Fake discrimina pelo from recebido e devolve QUANTIDADES DIFERENTES — com números
    // iguais nos dois períodos o teste passaria até com o filtro invertido
    // (rules/tests.md § "Cardinalidade simétrica não discrimina").
    mockedGet.mockImplementation(((_url: string, config?: { params?: { from?: string } }) => {
      const from = config?.params?.from
      if (from === '2026-06-01')
        return Promise.resolve(paginated([{ clientId: 1, horasUsadas: 4, percentualPlano: 40 }]))
      if (from === '2026-07-01')
        return Promise.resolve(paginated([{ clientId: 1, horasUsadas: 9, percentualPlano: 90 }]))
      return Promise.resolve(paginated([]))
    }) as unknown as typeof api.get)

    const junho = await getClientKpis(1, { from: '2026-06-01', to: '2026-06-30' })
    const julho = await getClientKpis(1, { from: '2026-07-01', to: '2026-07-31' })
    const semLinha = await getClientKpis(1, { from: '2026-08-01', to: '2026-08-31' })

    expect(junho).toEqual({ clientId: 1, horasUsadas: 4, percentualPlano: 40 })
    expect(julho).toEqual({ clientId: 1, horasUsadas: 9, percentualPlano: 90 })
    expect(semLinha).toBeNull()
  })

  it('getClientKpis pagina até achar, mantendo o período em TODAS as páginas, e retorna null se não houver linha', async () => {
    // Página 1 sem match, página 2 sem match — totalPages 2 → retorna null.
    mockedGet
      .mockResolvedValueOnce(paginated([{ clientId: 3 }], 2))
      .mockResolvedValueOnce(paginated([{ clientId: 4 }], 2))
    const result = await getClientKpis(1, { from: '2026-06-01', to: '2026-06-30' })
    expect(result).toBeNull()
    expect(mockedGet).toHaveBeenCalledTimes(2)
    const paginas = mockedGet.mock.calls.map(
      (call) => call[1]?.params as Record<string, unknown>,
    )
    expect(paginas[0]).toMatchObject({ page: 1, from: '2026-06-01', to: '2026-06-30' })
    expect(paginas[1]).toMatchObject({ page: 2, from: '2026-06-01', to: '2026-06-30' })
  })
})
