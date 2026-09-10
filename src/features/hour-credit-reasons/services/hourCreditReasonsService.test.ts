import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../services/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}))

import { api } from '../../../services/api'
import {
  createHourCreditReason,
  deleteHourCreditReason,
  listHourCreditReasons,
  updateHourCreditReason,
} from './hourCreditReasonsService'

/**
 * **JSON cru** do wire, como o servidor entrega — não um DTO montado em memória
 * (contrato-wire: chave divergente entre back e front passa silenciosa).
 * Os três itens são propositalmente diferentes: `isSistema` **true**, **false declarado**
 * e a chave **ausente** (o caso do backend anterior ao campo).
 */
const WIRE = [
  { id: 1, nome: 'Estorno de Credito Problema - Invoicy', isActive: true, isSistema: true },
  { id: 2, nome: 'Cortesia comercial', isActive: true, isSistema: false },
  { id: 3, nome: 'Legado', isActive: false },
]

describe('listHourCreditReasons', () => {
  beforeEach(() => vi.clearAllMocks())

  it('desempacota `ApiResponse.data` e manda `includeInactive` explícito', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: { data: WIRE } })

    const resultado = await listHourCreditReasons(false)

    expect(api.get).toHaveBeenCalledWith('/api/v1/hour-credit-reasons', {
      params: { includeInactive: false },
    })
    // Sem o desempacote, o consumidor receberia `{ data: [...] }` e a lista ficaria vazia.
    expect(resultado.map((m) => m.id)).toEqual([1, 2, 3])
  })

  it('🔴 `isSistema` atravessa o service nos TRÊS estados — inclusive ausente', async () => {
    // Vermelho se alguém puser projeção campo-a-campo (o campo sumiria), se a chave do
    // wire divergir, ou se alguém "normalizar" a ausência para `false` — que liberaria a
    // exclusão do motivo semeado contra um backend antigo (`AP-FRONTEND-021`).
    vi.mocked(api.get).mockResolvedValueOnce({ data: { data: WIRE } })

    const r = await listHourCreditReasons(true)

    expect(r[0].isSistema).toBe(true)
    expect(r[1].isSistema).toBe(false)
    expect(r[2]).not.toHaveProperty('isSistema')
    // Companheira positiva: o resto do DTO não regrediu junto.
    expect(r.map((m) => m.nome)).toEqual([
      'Estorno de Credito Problema - Invoicy',
      'Cortesia comercial',
      'Legado',
    ])
  })

  it('`includeInactive` é sempre explícito — nunca omitido para o default do servidor', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: { data: [] } })
    await listHourCreditReasons(true)
    expect(vi.mocked(api.get).mock.calls[0][1]?.params).toEqual({ includeInactive: true })
  })
})

describe('mutations de motivo', () => {
  beforeEach(() => vi.clearAllMocks())

  it('POST manda EXATAMENTE `{ nome }` e desempacota o envelope', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ data: { data: WIRE[1] } })

    const criado = await createHourCreditReason('Cortesia comercial')

    const [url, body] = vi.mocked(api.post).mock.calls[0]
    expect(url).toBe('/api/v1/hour-credit-reasons')
    // Identidade das chaves: `isSistema` no corpo deixaria o cliente forjar o motivo
    // protegido do processo automático.
    expect(Object.keys(body as object)).toEqual(['nome'])
    expect(criado.id).toBe(2)
  })

  it('PUT vai na URL do id, com EXATAMENTE `{ nome }`', async () => {
    vi.mocked(api.put).mockResolvedValueOnce({ data: { data: { ...WIRE[1], nome: 'Cortesia' } } })

    const atualizado = await updateHourCreditReason(2, 'Cortesia')

    const [url, body] = vi.mocked(api.put).mock.calls[0]
    expect(url).toBe('/api/v1/hour-credit-reasons/2')
    expect(Object.keys(body as object)).toEqual(['nome'])
    expect(atualizado.nome).toBe('Cortesia')
  })

  it('DELETE usa a URL do id (204, sem envelope)', async () => {
    vi.mocked(api.delete).mockResolvedValueOnce({ status: 204 })
    await deleteHourCreditReason(3)
    expect(vi.mocked(api.delete).mock.calls[0][0]).toBe('/api/v1/hour-credit-reasons/3')
  })
})
