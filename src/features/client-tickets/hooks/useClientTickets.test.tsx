import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { useClientTickets } from './useClientTickets'
// 123/FE-FIX3 (F-3): `primeiroDiaDoMesAtual`/`ultimoDiaDoMesAtual` foram consolidados em
// `defaultCurrentMonthFullPeriod`, o dono estabelecido do conceito "mês corrente inteiro".
import { defaultCurrentMonthFullPeriod } from '../../reports/shared/utils/defaultPeriod'
import * as service from '../services/clientTicketsService'

vi.mock('../services/clientTicketsService', () => ({
  listClientTickets: vi.fn(),
}))

function wrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
}

describe('useClientTickets', () => {
  beforeEach(() => {
    vi.mocked(service.listClientTickets).mockReset()
    vi.mocked(service.listClientTickets).mockResolvedValue({
      items: [],
      totalCount: 0,
      page: 1,
      pageSize: 25,
      totalPages: 0,
    })
  })

  it('passa o clientId ao service', async () => {
    renderHook(() => useClientTickets(1), { wrapper: wrapper() })
    await waitFor(() => {
      expect(service.listClientTickets).toHaveBeenCalledWith(
        expect.objectContaining({ clientId: 1 }),
      )
    })
  })

  it('inicia com status array vazio e sortDirection desc', () => {
    const { result } = renderHook(() => useClientTickets(1), { wrapper: wrapper() })
    expect(result.current.filters.status).toEqual([])
    expect(result.current.sortDirection).toBe('desc')
  })

  it('inicia com teamId e owner arrays vazios (070)', () => {
    const { result } = renderHook(() => useClientTickets(1), { wrapper: wrapper() })
    expect(result.current.filters.teamId).toEqual([])
    expect(result.current.filters.owner).toEqual([])
  })

  it('encaminha teamId e owner ao service quando preenchidos (070)', async () => {
    const { result } = renderHook(() => useClientTickets(1), { wrapper: wrapper() })

    result.current.setFilters({ teamId: [1, 2], owner: [7] })

    await waitFor(() => {
      expect(service.listClientTickets).toHaveBeenCalledWith(
        expect.objectContaining({ teamId: [1, 2], owner: [7] }),
      )
    })
  })

  /**
   * 123/FE-PER (D-2) — este teste AFIRMAVA o defeito: sem datas iniciais, o filtro nascia
   * nulo e as duas metades da tela caíam em defaults OPOSTOS do backend (mês corrente nos
   * KPIs, sem restrição nenhuma na tabela). O usuário decidiu o contrário — *"mantenha
   * sempre o filtro do mês atual por padrão"* — e o teste foi INVERTIDO no mesmo commit,
   * não apagado.
   */
  it('inicia from/to no MÊS ATUAL quando sem datas iniciais (123/D-2)', () => {
    const { result } = renderHook(() => useClientTickets(1), { wrapper: wrapper() })
    expect(result.current.filters.from).toBe(defaultCurrentMonthFullPeriod().from)
    expect(result.current.filters.to).toBe(defaultCurrentMonthFullPeriod().to)
    // Companheiro NÃO derivado do módulo (o irmão com valor literal está em
    // `periodoPadrao.test.ts` e no teste de wire): a ponta inicial é o dia 1 de um mês,
    // nunca "hoje". Vermelho se o default virar `new Date()` ou "últimos 30 dias".
    expect(result.current.filters.from).toMatch(/^\d{4}-\d{2}-01$/)
    expect(result.current.filters.to).toMatch(/^\d{4}-\d{2}-(28|29|30|31)$/)
  })

  it('semeia from/to a partir das datas iniciais e as encaminha ao service (095)', async () => {
    const { result } = renderHook(
      () => useClientTickets(1, { from: '2026-06-01', to: '2026-06-30' }),
      { wrapper: wrapper() },
    )
    expect(result.current.filters.from).toBe('2026-06-01')
    expect(result.current.filters.to).toBe('2026-06-30')

    await waitFor(() => {
      expect(service.listClientTickets).toHaveBeenCalledWith(
        expect.objectContaining({ from: '2026-06-01', to: '2026-06-30' }),
      )
    })
  })

  it('encaminha from/to ao service ao alterar o período (095)', async () => {
    const { result } = renderHook(() => useClientTickets(1), { wrapper: wrapper() })

    result.current.setFilters({ from: '2026-07-01', to: '2026-07-15' })

    await waitFor(() => {
      expect(service.listClientTickets).toHaveBeenCalledWith(
        expect.objectContaining({ from: '2026-07-01', to: '2026-07-15' }),
      )
    })
  })

  /**
   * Irmão do anterior, do lado do WIRE. Antes afirmava `undefined` nas duas pontas — que era
   * exatamente o que fazia `/reports/tickets` responder sem restrição de data enquanto os
   * KPIs vinham do mês corrente. Invertido pela D-2.
   */
  it('manda from/to do MÊS ATUAL ao service quando o período está em branco (123/D-2)', async () => {
    renderHook(() => useClientTickets(1), { wrapper: wrapper() })
    await waitFor(() => {
      expect(service.listClientTickets).toHaveBeenCalled()
    })
    const lastCall = vi.mocked(service.listClientTickets).mock.calls.at(-1)?.[0]
    expect(lastCall?.from).toBe(defaultCurrentMonthFullPeriod().from)
    expect(lastCall?.to).toBe(defaultCurrentMonthFullPeriod().to)
  })

  it('limpar UMA ponta fecha só ela no mês atual (a outra continua a do usuário)', async () => {
    const { result } = renderHook(
      () => useClientTickets(1, { from: '2026-06-01', to: '2026-06-30' }),
      { wrapper: wrapper() },
    )

    result.current.setFilters({ to: null })

    await waitFor(() => {
      const lastCall = vi.mocked(service.listClientTickets).mock.calls.at(-1)?.[0]
      expect(lastCall?.to).toBe(defaultCurrentMonthFullPeriod().to)
    })
    const lastCall = vi.mocked(service.listClientTickets).mock.calls.at(-1)?.[0]
    // Vermelho se a resolução virar "tudo ou nada" e sequestrar a ponta escolhida.
    expect(lastCall?.from).toBe('2026-06-01')
  })
})
