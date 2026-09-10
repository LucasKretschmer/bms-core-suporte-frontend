import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../services/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))

import { api } from '../../../services/api'
import {
  closeBillingPeriod,
  getBillingPeriod,
  listBillingPeriodComparison,
  listBillingPeriods,
  reopenBillingPeriod,
} from './billingPeriodsService'

/** Envelope paginado CRU, como o wire entrega (`{items,…}` — sem `data`). */
const WIRE_PAGINADO = {
  items: [
    {
      competencia: '2026-08',
      estado: 'fechada',
      fechadaEm: '2026-09-01T03:00:00Z',
      fechadaPorNome: null,
      reabertaEm: null,
      reabertaPorNome: null,
      reaberturaMotivo: null,
      versao: 1,
      totalClientes: 42,
      totalHorasAdicionais: 12.5,
    },
  ],
  totalCount: 1,
  page: 1,
  pageSize: 25,
  totalPages: 1,
}

describe('billingPeriodsService — os DOIS envelopes', () => {
  beforeEach(() => vi.clearAllMocks())

  it('GET /billing-periods devolve o envelope CRU (não desempacota `.data`)', async () => {
    // Errar o envelope aqui não dá erro de tipo em lugar nenhum — a tela só fica vazia.
    vi.mocked(api.get).mockResolvedValueOnce({ data: WIRE_PAGINADO })

    const resultado = await listBillingPeriods({ page: 2, pageSize: 50 })

    expect(api.get).toHaveBeenCalledWith('/api/v1/billing-periods', {
      params: { page: 2, pageSize: 50 },
    })
    expect(resultado.items).toHaveLength(1)
    expect(resultado.totalCount).toBe(1)
    // As chaves do wire sobrevivem inteiras — nada de projeção campo a campo no service.
    expect(resultado.items[0].estado).toBe('fechada')
    expect(resultado.items[0].fechadaPorNome).toBeNull()
  })

  it('GET /billing-periods usa page 1 / pageSize 25 por padrão', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: WIRE_PAGINADO })
    await listBillingPeriods()
    expect(api.get).toHaveBeenCalledWith('/api/v1/billing-periods', {
      params: { page: 1, pageSize: 25 },
    })
  })

  it('GET /billing-periods/{competencia} DESEMPACOTA `.data` (ApiResponse)', async () => {
    // O envelope aqui é outro — é a razão de o desempacotamento morar no service.
    vi.mocked(api.get).mockResolvedValueOnce({ data: { data: WIRE_PAGINADO.items[0] } })

    const resultado = await getBillingPeriod('2026-08')

    expect(api.get).toHaveBeenCalledWith('/api/v1/billing-periods/2026-08')
    expect(resultado.competencia).toBe('2026-08')
  })

  it('GET .../comparison devolve o envelope CRU e manda clientId só quando há filtro', async () => {
    const wire = { ...WIRE_PAGINADO, items: [] }
    vi.mocked(api.get).mockResolvedValue({ data: wire })

    await listBillingPeriodComparison({ competencia: '2026-08', clientId: 7, page: 3, pageSize: 50 })
    expect(api.get).toHaveBeenLastCalledWith('/api/v1/billing-periods/2026-08/comparison', {
      params: { page: 3, pageSize: 50, clientId: 7 },
    })

    // Sem cliente, a chave NÃO viaja: `clientId=` vazio na query chega ao ASP.NET como
    // tentativa de bind e vira 400 em vez de "sem filtro".
    await listBillingPeriodComparison({ competencia: '2026-08', clientId: null })
    expect(api.get).toHaveBeenLastCalledWith('/api/v1/billing-periods/2026-08/comparison', {
      params: { page: 1, pageSize: 25 },
    })
  })
})

describe('billingPeriodsService — escrita', () => {
  beforeEach(() => vi.clearAllMocks())

  it('POST .../close vai na rota certa, sem corpo', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ data: {} })
    await closeBillingPeriod('2026-08')
    expect(api.post).toHaveBeenCalledWith('/api/v1/billing-periods/2026-08/close')
  })

  it('POST .../reopen manda EXATAMENTE {motivo, confirmarImpactoEmCreditos}', async () => {
    // 🔴 Identidade das chaves, não `toMatchObject`: campo a mais no corpo (um `usuario`,
    // um `competencia` repetido) é escalada de privilégio esperando acontecer
    // (`security.md` § "nunca aceitar no body"). `toMatchObject` passaria com todos eles.
    vi.mocked(api.post).mockResolvedValueOnce({ data: {} })

    await reopenBillingPeriod('2026-08', {
      motivo: 'Fatura corrigida pelo financeiro',
      confirmarImpactoEmCreditos: true,
    })

    const [url, corpo] = vi.mocked(api.post).mock.calls[0]
    expect(url).toBe('/api/v1/billing-periods/2026-08/reopen')
    expect(Object.keys(corpo as Record<string, unknown>).sort()).toEqual([
      'confirmarImpactoEmCreditos',
      'motivo',
    ])
    expect(corpo).toEqual({
      motivo: 'Fatura corrigida pelo financeiro',
      confirmarImpactoEmCreditos: true,
    })
  })

  it('o `false` da confirmação viaja como `false` — nunca é omitido', async () => {
    // Omitir o campo faria o servidor ler "não confirmado" por ausência em vez de por
    // valor: mesmo raciocínio do spread condicional proibido em `serviceCategoriesService`.
    vi.mocked(api.post).mockResolvedValueOnce({ data: {} })
    await reopenBillingPeriod('2026-08', { motivo: 'teste', confirmarImpactoEmCreditos: false })
    expect(vi.mocked(api.post).mock.calls[0][1]).toEqual({
      motivo: 'teste',
      confirmarImpactoEmCreditos: false,
    })
  })

  it('a competência é escapada na URL', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ data: {} })
    await closeBillingPeriod('2026/08')
    expect(api.post).toHaveBeenCalledWith('/api/v1/billing-periods/2026%2F08/close')
  })
})
