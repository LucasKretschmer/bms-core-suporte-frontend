/**
 * 123/FAT-1 — `apenasFatura` no wire de `GET /api/v1/reports/tickets`.
 *
 * O parâmetro existia implementado e testado no backend (`ReportsController.cs:254`,
 * predicado em `ReportQueryRepository.cs:1032-1036`) e **nenhum chamador no painel** — grep
 * de `apenasFatura` em `src/` dava zero. Este arquivo trava as duas pontas do contrato.
 *
 * Por que testar a QUERY STRING e não só o objeto `params`: neste projeto o contrato de wire
 * já falhou em silêncio duas vezes (chave JSON divergente; array serializado com `[]`, que o
 * model binder do ASP.NET ignora sem erro — daí o `paramsSerializer { indexes: null }` em
 * `services/api.ts:40`). Objeto certo com serialização errada é 200 com filtro ignorado.
 *
 * O que deixa cada asserção VERMELHA:
 *  · esquecer de repassar `apenasFatura` do hook ao service → a chave desaparece do `params`;
 *  · mandar `'true'`/`1`/`'on'` em vez do booleano → o `toBe(true)` cai;
 *  · mandar `apenasFatura=false` quando desligado → o assert de ausência cai (é ruído no
 *    wire para o mesmo efeito do default do controller);
 *  · trocar o serializer por um que emita `apenasFatura[]=true` → o assert de query string
 *    cai, e é exatamente a forma que o backend ignoraria.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { listClientTickets } from './clientTicketsService'
import { api } from '../../../services/api'

vi.mock('../../../services/api', () => ({
  api: { get: vi.fn() },
}))

const mockedGet = vi.mocked(api.get)

function paginated() {
  return { data: { items: [], totalCount: 0, page: 1, pageSize: 25, totalPages: 1 } }
}

function paramsDaChamada(): Record<string, unknown> {
  return mockedGet.mock.calls[0][1]?.params as Record<string, unknown>
}

describe('listClientTickets — apenasFatura no objeto de params', () => {
  beforeEach(() => {
    mockedGet.mockReset()
    mockedGet.mockResolvedValue(paginated())
  })

  it('`true` chega como BOOLEANO, não como string', async () => {
    await listClientTickets({ clientId: 1, apenasFatura: true, page: 1, pageSize: 25 })
    // `[FromQuery] bool apenasFatura` liga "true"/"True"/"TRUE"; `'on'`, `1` ou `'sim'` dão
    // 400 de model binding, que o toast genérico esconde (memória do projeto: DTO/param com
    // tipo errado = 400 silencioso).
    expect(paramsDaChamada().apenasFatura).toBe(true)
  })

  it('`undefined` OMITE a chave (cleanParams) — o default do controller já é false', async () => {
    await listClientTickets({ clientId: 1, apenasFatura: undefined, page: 1, pageSize: 25 })
    expect(paramsDaChamada()).not.toHaveProperty('apenasFatura')
  })

  it('sem o parâmetro na chamada, a chave também não vai ao wire', async () => {
    await listClientTickets({ clientId: 1, page: 1, pageSize: 25 })
    expect(paramsDaChamada()).not.toHaveProperty('apenasFatura')
  })

  it('`false` seria removido pelo cleanParams? NÃO — e é por isso que o call site manda `|| undefined`', async () => {
    // Documenta o comportamento REAL do helper (`v !== null && v !== undefined && v !== ''`):
    // `false` sobrevive. É correto no wire (`apenasFatura=false` liga a `false`), mas o call
    // site converte para `undefined` para não mandar parâmetro inútil. Se alguém "limpar" o
    // `|| undefined` do hook achando que o cleanParams cuida, este teste explica que não.
    await listClientTickets({ clientId: 1, apenasFatura: false, page: 1, pageSize: 25 })
    expect(paramsDaChamada().apenasFatura).toBe(false)
  })

  it('apenasFatura conviva com from/to e com os filtros de array', async () => {
    // Cenário real do drawer: recorte de fatura + período + multi-select.
    await listClientTickets({
      clientId: 1,
      from: '2026-08-01',
      to: '2026-08-31',
      status: ['Fechado'],
      teamId: [3],
      apenasFatura: true,
      page: 1,
      pageSize: 25,
    })
    const p = paramsDaChamada()
    expect(p.apenasFatura).toBe(true)
    expect(p.from).toBe('2026-08-01')
    expect(p.to).toBe('2026-08-31')
    expect(p.status).toEqual(['Fechado'])
    expect(p.teamId).toEqual([3])
  })
})

describe('serialização REAL da query string (instância axios do projeto)', () => {
  /**
   * `vi.importActual` fura o mock acima de propósito: aqui o objeto sob teste é a INSTÂNCIA
   * de verdade, com o `paramsSerializer` de `services/api.ts`. `getUri` aplica exatamente o
   * serializer que a request usaria.
   */
  async function uriReal(params: Record<string, unknown>): Promise<string> {
    const actual = await vi.importActual<typeof import('../../../services/api')>(
      '../../../services/api',
    )
    return actual.api.getUri({ url: '/api/v1/reports/tickets', params })
  }

  it('apenasFatura=true sai como `apenasFatura=true`, sem colchetes nem índice', async () => {
    const uri = await uriReal({ apenasFatura: true })
    expect(uri).toContain('apenasFatura=true')
    // A forma que o model binder do ASP.NET ignoraria em silêncio.
    expect(uri).not.toContain('apenasFatura[]')
    expect(uri).not.toContain('apenasFatura%5B%5D')
  })

  it('controle positivo do serializer: array continua em formato "repeat"', async () => {
    // Prova que a instância importada é a real (com `indexes: null`) e não um axios cru —
    // sem isto, o assert acima poderia estar medindo um serializer default qualquer.
    const uri = await uriReal({ status: ['Aberto', 'Fechado'] })
    expect(uri).toContain('status=Aberto')
    expect(uri).toContain('status=Fechado')
    expect(uri).not.toContain('status%5B0%5D')
  })
})
