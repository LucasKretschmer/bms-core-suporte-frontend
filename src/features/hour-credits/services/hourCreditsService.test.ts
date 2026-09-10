import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../services/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}))

import { api } from '../../../services/api'
import {
  createHourCredit,
  deleteHourCredit,
  listHourCredits,
  updateHourCredit,
} from './hourCreditsService'
import type { HourCreditDto } from '../types/hourCredit'

const credito: HourCreditDto = {
  id: 10,
  clientId: 42,
  clienteNome: 'Acme',
  horas: 2,
  competencia: '2026-09',
  status: 'vigente',
  origem: 'manual',
  motivoId: 3,
  motivoNome: 'Estorno de Credito Problema - Invoicy',
  criadoEm: '2026-09-08T12:00:00Z',
}

/** Params obrigatórios da listagem — o resto é opcional. */
const BASE_PARAMS = { page: 1, pageSize: 25 } as const

function paramsDaChamada(): Record<string, unknown> {
  const chamada = vi.mocked(api.get).mock.calls[0]
  return (chamada[1]?.params ?? {}) as Record<string, unknown>
}

describe('listHourCredits — envelope CRU (PaginatedResponse)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('🔴 devolve o envelope paginado INTEIRO, sem desempacotar `.data`', () => {
    // Os dois envelopes convivem nesta feature: GET é cru, POST/PUT são `ApiResponse<T>`.
    // Desempacotar aqui devolveria `undefined` e a tabela ficaria vazia **sem erro de
    // tipo e sem erro de runtime** — a falha mais silenciosa possível.
    const envelope = { items: [credito], totalCount: 1, page: 1, pageSize: 25, totalPages: 1 }
    vi.mocked(api.get).mockResolvedValueOnce({ data: envelope })

    return listHourCredits({ ...BASE_PARAMS }).then((resultado) => {
      expect(resultado).toEqual(envelope)
      expect(resultado.items[0].motivoNome).toBe('Estorno de Credito Problema - Invoicy')
    })
  })

  it('a URL é /api/v1/hour-credits e o filtro de status viaja como ARRAY', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      data: { items: [], totalCount: 0, page: 1, pageSize: 25, totalPages: 0 },
    })

    await listHourCredits({
      ...BASE_PARAMS,
      clientId: 42,
      competencia: '2026-09',
      status: ['vigente', 'expirado'],
      origem: 'manual',
      search: 'acme',
      sortBy: 'criadoem',
      sortDirection: 'desc',
    })

    expect(vi.mocked(api.get).mock.calls[0][0]).toBe('/api/v1/hour-credits')
    const p = paramsDaChamada()
    expect(p.status).toEqual(['vigente', 'expirado'])
    expect(p.clientId).toBe(42)
    expect(p.competencia).toBe('2026-09')
    expect(p.origem).toBe('manual')
    expect(p.sortBy).toBe('criadoem')
  })

  it('🔴 filtro vazio NÃO vira parâmetro: `status: []` some, `search: ""` some', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      data: { items: [], totalCount: 0, page: 1, pageSize: 25, totalPages: 0 },
    })

    await listHourCredits({ ...BASE_PARAMS, status: [], search: '', clientId: null })

    const p = paramsDaChamada()
    // Um `status=` vazio na query é `400 INVALID_STATUS` no servidor (fail-closed na
    // borda): "sem filtro" viraria erro de tela.
    expect(Object.keys(p).sort()).toEqual(['page', 'pageSize'])
  })
})

describe('createHourCredit / updateHourCredit — envelope ApiResponse', () => {
  beforeEach(() => vi.clearAllMocks())

  it('🔴 o corpo do POST tem EXATAMENTE {clientId, horas, motivoId} — identidade das chaves', async () => {
    // `toMatchObject` passaria com campos a mais. E campo a mais aqui é escalada de
    // privilégio: `origem: "automatico"` no body deixaria o cliente forjar um crédito do
    // processo automático; `criadoPorUserId` deixaria assinar em nome de outro
    // (`rules/security.md` § "nunca aceitar no body").
    vi.mocked(api.post).mockResolvedValueOnce({ data: { data: credito } })

    await createHourCredit({ clientId: 42, horas: 2, motivoId: 3 })

    const [url, body] = vi.mocked(api.post).mock.calls[0]
    expect(url).toBe('/api/v1/hour-credits')
    expect(Object.keys(body as object).sort()).toEqual(['clientId', 'horas', 'motivoId'])
    expect(body).toEqual({ clientId: 42, horas: 2, motivoId: 3 })
  })

  it('o POST desempacota `.data` do envelope ApiResponse', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ data: { data: credito } })
    const criado = await createHourCredit({ clientId: 42, horas: 2, motivoId: 3 })
    // Sem o desempacote, o retorno seria `{ data: {...} }` e todo consumidor leria
    // `undefined` nos campos.
    expect(criado.id).toBe(10)
    expect(criado.horas).toBe(2)
  })

  it('🔴 o corpo do PUT tem EXATAMENTE {horas, motivoId} — sem competência (D8′)', async () => {
    vi.mocked(api.put).mockResolvedValueOnce({ data: { data: { ...credito, horas: 5 } } })

    const atualizado = await updateHourCredit(10, { horas: 5, motivoId: 4 })

    const [url, body] = vi.mocked(api.put).mock.calls[0]
    expect(url).toBe('/api/v1/hour-credits/10')
    expect(Object.keys(body as object).sort()).toEqual(['horas', 'motivoId'])
    expect(atualizado.horas).toBe(5)
  })

  it('DELETE chama a URL do id e não espera envelope (204)', async () => {
    vi.mocked(api.delete).mockResolvedValueOnce({ status: 204 })
    await deleteHourCredit(10)
    expect(vi.mocked(api.delete).mock.calls[0][0]).toBe('/api/v1/hour-credits/10')
  })
})

describe('serialização REAL da query string (instância axios do projeto)', () => {
  /**
   * `vi.importActual` fura o mock do topo de propósito: aqui o objeto sob teste é a
   * INSTÂNCIA de verdade, com o `paramsSerializer` de `services/api.ts`. `getUri` aplica
   * exatamente o serializer que a request usaria — o objeto de params em memória não
   * prova nada sobre o que chega ao ASP.NET (memória `contrato-wire-backend-frontend`).
   *
   * ⚠️ A instância real é carregada UMA vez, em `beforeAll` com prazo próprio. Fazer o
   * `importActual` dentro do `it` colocava o custo de carregar `services/api.ts` (e a
   * árvore de interceptors) **dentro** do prazo de 5s do teste: sob carga a suíte
   * estourava o tempo no PRIMEIRO caso e passava no segundo, que já achava o módulo em
   * cache — falha intermitente que não diz nada sobre o serializer
   * (`rules/tests.md`: resultado que muda entre execuções não é resultado).
   */
  let apiReal: typeof import('../../../services/api')['api']

  beforeAll(async () => {
    const actual = await vi.importActual<typeof import('../../../services/api')>(
      '../../../services/api',
    )
    apiReal = actual.api
  }, 60_000)

  function uriReal(params: Record<string, unknown>): string {
    return apiReal.getUri({ url: '/api/v1/hour-credits', params })
  }

  it('🔴 `status[]` sai em formato "repeat", SEM colchetes e SEM índices', () => {
    const uri = uriReal({ status: ['vigente', 'expirado'] })
    expect(uri).toContain('status=vigente')
    expect(uri).toContain('status=expirado')
    // As duas formas que o model binder do ASP.NET ignoraria em silêncio — o filtro
    // simplesmente não aconteceria, e a tela mostraria tudo como se estivesse certo.
    expect(uri).not.toContain('status%5B0%5D')
    expect(uri).not.toContain('status%5B%5D')
  })

  it('controle positivo: valor único continua saindo inteiro pelo mesmo serializer', () => {
    // Sem isto, o assert acima poderia estar medindo um axios cru qualquer.
    const uri = uriReal({ competencia: '2026-09', page: 2 })
    expect(uri).toContain('competencia=2026-09')
    expect(uri).toContain('page=2')
  })
})
