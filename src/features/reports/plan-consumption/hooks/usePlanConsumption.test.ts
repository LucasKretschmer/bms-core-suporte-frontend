import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, act } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { format, startOfMonth } from 'date-fns'
import { usePlanConsumption } from './usePlanConsumption'
import * as reportsService from '../../shared/services/reportsService'
import { api } from '../../../../services/api'
import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import type { PaginatedResponse } from '../../../../types/api'
import type { PlanConsumptionItemDto } from '../../shared/types/reports'
import React from 'react'

const emptyResponse: PaginatedResponse<PlanConsumptionItemDto> = {
  items: [],
  totalCount: 0,
  page: 1,
  pageSize: 25,
  totalPages: 0,
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children)
}

describe('usePlanConsumption', () => {
  beforeEach(() => {
    vi.spyOn(reportsService, 'listPlanConsumption').mockResolvedValue(emptyResponse)
  })

  it('inicia com page=1 e pageSize=25', () => {
    const { result } = renderHook(() => usePlanConsumption(), { wrapper: createWrapper() })
    expect(result.current.page).toBe(1)
    expect(result.current.pageSize).toBe(25)
  })

  it('inicia com search/planId vazios e período = mês corrente (clearable)', () => {
    const today = new Date()
    const { result } = renderHook(() => usePlanConsumption(), { wrapper: createWrapper() })
    expect(result.current.filters.search).toBe('')
    expect(result.current.filters.planId).toBeNull()
    expect(result.current.filters.from).toBe(format(startOfMonth(today), 'yyyy-MM-dd'))
    expect(result.current.filters.to).toBe(format(today, 'yyyy-MM-dd'))
  })

  it('período é clearable (usuário pode limpar from/to para null)', () => {
    const { result } = renderHook(() => usePlanConsumption(), { wrapper: createWrapper() })
    act(() => result.current.setFilters({ from: null, to: null }))
    expect(result.current.filters.from).toBeNull()
    expect(result.current.filters.to).toBeNull()
  })

  it('enabled=true sempre (não requer filtros obrigatórios)', () => {
    const spy = vi.spyOn(reportsService, 'listPlanConsumption').mockResolvedValue(emptyResponse)
    renderHook(() => usePlanConsumption(), { wrapper: createWrapper() })
    // Query é disparada mesmo sem filtros preenchidos
    expect(spy).toHaveBeenCalled()
  })

  it('ao mudar filtro reseta page para 1', () => {
    const { result } = renderHook(() => usePlanConsumption(), { wrapper: createWrapper() })

    act(() => result.current.setPage(3))
    expect(result.current.page).toBe(3)

    act(() => result.current.setFilters({ search: 'teste' }))
    expect(result.current.page).toBe(1)
    expect(result.current.filters.search).toBe('teste')
  })

  it('ao mudar planId reseta page para 1', () => {
    const { result } = renderHook(() => usePlanConsumption(), { wrapper: createWrapper() })

    act(() => result.current.setPage(2))
    act(() => result.current.setFilters({ planId: 'plan-123' }))

    expect(result.current.page).toBe(1)
    expect(result.current.filters.planId).toBe('plan-123')
  })

  it('ao mudar período reseta page para 1', () => {
    const { result } = renderHook(() => usePlanConsumption(), { wrapper: createWrapper() })

    act(() => result.current.setPage(4))
    act(() => result.current.setFilters({ from: '2024-01-01', to: '2024-01-31' }))

    expect(result.current.page).toBe(1)
    expect(result.current.filters.from).toBe('2024-01-01')
    expect(result.current.filters.to).toBe('2024-01-31')
  })

  // ── 135/G5 — o filtro "Uso do plano" ───────────────────────────────────────

  it('🔴 T-11: `usoPlano` nasce como ARRAY VAZIO, nunca `undefined`', () => {
    const { result } = renderHook(() => usePlanConsumption(), { wrapper: createWrapper() })

    // `valorExibidoUsoDoPlano` (o que o combobox recebe) NÃO tolera `undefined` de
    // propósito: inicializar com `undefined` estouraria em `.length` na 1ª render da tela.
    // Por isso a asserção é sobre a FORMA, não só sobre a vacuidade.
    expect(Array.isArray(result.current.filters.usoPlano)).toBe(true)
    expect(result.current.filters.usoPlano).toEqual([])
    expect(result.current.filters.usoPlano).not.toBeUndefined()
  })

  /**
   * 🔴 **T-12 — os dois lados de `[] → undefined`, sem depender de REFETCH.**
   *
   * ⚠️ **Medido, e é a razão da forma deste caso:** voltar a seleção para `[]` devolve o
   * observador a uma `queryKey` **já usada** (a inicial), e nessa volta o TanStack **não
   * dispara** chamada nova de forma observável dentro do `vi.waitFor` (1 s) — o
   * comportamento muda conforme o `act()` tenha ou não flushado a re-render. Uma asserção
   * do tipo *"o número de chamadas cresceu"* aí é **temporal, não comportamental**: ela
   * fica vermelha por causa do cache, não por causa do defeito que deveria pegar.
   *
   * A forma abaixo não tem essa dependência, e mata a mesma mutação:
   *  · o lado NEGATIVO já está na **1ª render** (o estado inicial é `[]`) — se o call site
   *    mandar `[]` cru, a **primeira** chamada já carrega o array vazio;
   *  · o lado POSITIVO é a seleção real viajando verbatim;
   *  · a invariante global fecha: **nenhuma** chamada, em momento nenhum, levou `[]`.
   */
  it('🔴 T-12: `[]` NÃO viaja (nem na 1ª render); a seleção viaja como array e reseta a página', async () => {
    const spy = vi.spyOn(reportsService, 'listPlanConsumption').mockResolvedValue(emptyResponse)
    const { result } = renderHook(() => usePlanConsumption(), { wrapper: createWrapper() })

    // (a) Lado NEGATIVO — o estado inicial é `[]` ("todos") e o parâmetro **não sai**.
    // `cleanParams` do service descarta `null`/`undefined`/`''` e **não** array vazio
    // (medido em `reportsService.test.ts`), logo um `[]` cru viajaria como `?usoPlano=`.
    await vi.waitFor(() => expect(spy.mock.calls.length).toBeGreaterThan(0))
    expect(result.current.filters.usoPlano).toEqual([])
    expect(spy.mock.calls[0]?.[0]?.usoPlano).toBeUndefined()
    expect('usoPlano' in (spy.mock.calls[0]?.[0] ?? {})).toBe(true)

    act(() => result.current.setPage(3))
    expect(result.current.page).toBe(3)

    act(() => result.current.setFilters({ usoPlano: ['risco'] }))
    expect(result.current.page).toBe(1)
    expect(result.current.filters.usoPlano).toEqual(['risco'])

    // (b) Lado POSITIVO, o par obrigatório: a seleção chega ao transporte como array,
    // verbatim. Sem ele, o lado (a) passaria numa tela que nunca manda o parâmetro (M-6).
    await vi.waitFor(() => {
      const ultima = spy.mock.calls[spy.mock.calls.length - 1]?.[0]
      expect(ultima?.usoPlano).toEqual(['risco'])
    })

    // (c) Desmarcar a última faixa volta o estado a `[]` — "nada selecionado" é o MESMO
    // valor de "Todos" (G2), não um terceiro estado.
    act(() => result.current.setFilters({ usoPlano: [] }))
    expect(result.current.filters.usoPlano).toEqual([])

    // (d) E em NENHUM momento o array vazio foi ao transporte. É a asserção que a mutação
    // "trocar `[] → undefined` por `[]` cru" derruba, e ela não depende de cache nenhum.
    const todas = spy.mock.calls.map((c) => c[0])
    expect(
      todas.filter((p) => Array.isArray(p.usoPlano) && p.usoPlano.length === 0),
    ).toEqual([])
  })

  it('🔴 T-13: mudar SÓ `usoPlano` provoca nova requisição com o valor novo', async () => {
    const spy = vi.spyOn(reportsService, 'listPlanConsumption').mockResolvedValue(emptyResponse)
    const { result } = renderHook(() => usePlanConsumption(), { wrapper: createWrapper() })

    await vi.waitFor(() => expect(spy.mock.calls.length).toBeGreaterThan(0))
    const antes = spy.mock.calls.length

    act(() => result.current.setFilters({ usoPlano: ['dentro'] }))

    // Prova COMPORTAMENTAL de que o campo entra na `queryKey` — sem afirmar a forma da
    // chave, que é montada dentro de `useServerTable` (asseverá-la campo a campo mediria
    // aquele hook, não esta demanda). As DUAS condições são necessárias: só "cresceu"
    // passaria com o valor antigo repetido; só "último argumento mudou" passaria com uma
    // chamada que já existia.
    await vi.waitFor(() => {
      expect(spy.mock.calls.length).toBeGreaterThan(antes)
      expect(spy.mock.calls[spy.mock.calls.length - 1]?.[0]?.usoPlano).toEqual(['dentro'])
    })
  })

  /**
   * 🔴 **T-W — a QUERY STRING real, do estado do filtro até a URL.**
   *
   * É **composição**, não repetição: a T-05 (U1) prova o **serializer** isolado e
   * `reportsService.test.ts` prova que `cleanParams` **não** descarta array vazio.
   * Nenhuma das duas prova o que o usuário produz — `filters.usoPlano` → call site →
   * service real → axios real → URL. Aqui o **único** mock é o **adapter** (a rede): o
   * URI é lido do mesmo `config` que o axios entregaria ao transporte.
   */
  it('🔴 T-W: `[]` ⇒ `usoPlano` NÃO aparece na URL; faixas ⇒ repeat SEM colchetes', async () => {
    // Desfaz o espião do `beforeEach`: este caso precisa do service DE VERDADE.
    vi.restoreAllMocks()

    const uris: string[] = []
    const adapterOriginal = api.defaults.adapter
    api.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
      uris.push(api.getUri(config))
      return {
        data: emptyResponse,
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      } as AxiosResponse
    }

    try {
      const { result } = renderHook(() => usePlanConsumption(), { wrapper: createWrapper() })
      await vi.waitFor(() => expect(uris.length).toBeGreaterThan(0))

      // (a) Estado inicial `[]` (= "todos"): o parâmetro **não sai**. E a companheira
      // POSITIVA na mesma URL — sem ela, "não contém `usoPlano`" passaria com uma URL
      // vazia ou com a requisição nem tendo acontecido.
      expect(uris[0]).toContain('/metrics/plan-consumption')
      expect(uris[0]).toContain('page=1')
      expect(uris[0]).not.toContain('usoPlano')

      // (b) Seleção parcial: repeat, na ordem, **sem** colchetes e **sem** índices — é a
      // grafia que o model binding do ASP.NET liga a `string[]`. O default do axios v1
      // (`usoPlano[]=…`) o servidor ignoraria, e o filtro morreria em silêncio.
      act(() => result.current.setFilters({ usoPlano: ['dentro', 'risco'] }))
      await vi.waitFor(() => expect(uris.length).toBeGreaterThan(1))

      const ultima = uris[uris.length - 1] ?? ''
      expect(ultima).toContain('usoPlano=dentro&usoPlano=risco')
      expect(ultima).not.toContain('usoPlano[')
      expect(ultima).not.toContain('usoPlano%5B')
      expect(ultima).not.toContain('usoPlano=dentro%2Crisco')
    } finally {
      api.defaults.adapter = adapterOriginal
    }
  })

  it('🔴 T-21(a): 400 do servidor ⇒ `isError`, e `data` NÃO vira lista vazia', async () => {
    // A metade de HOOK do invariante "400 do filtro não vira vazio": o token inválido
    // (bundle velho depois de uma troca de vocabulário) responde 400 `INVALID_USO_PLANO`, e
    // o que o hook publica é ERRO — não um envelope com `items: []`. A metade de COMPONENTE
    // (a tela mostra `ErrorState`, nunca a mensagem de vazio) está em `index.test.tsx`.
    vi.spyOn(reportsService, 'listPlanConsumption').mockRejectedValue(
      new Error('Request failed with status code 400'),
    )
    const { result } = renderHook(() => usePlanConsumption(), { wrapper: createWrapper() })

    await vi.waitFor(() => expect(result.current.isError).toBe(true))
    // 🔴 O discriminador: `data` ausente ≠ `data` com zero itens. Um transporte que
    // engolisse o 400 e devolvesse `{ items: [] }` deixaria a tela dizer "nenhum cliente"
    // sobre uma requisição que o servidor RECUSOU.
    expect(result.current.data).toBeUndefined()
  })

  it('chama listPlanConsumption com os filtros corretos', async () => {
    const spy = vi.spyOn(reportsService, 'listPlanConsumption').mockResolvedValue(emptyResponse)

    const { result } = renderHook(() => usePlanConsumption(), { wrapper: createWrapper() })

    act(() => result.current.setFilters({ search: 'cliente', planId: 'plano-abc' }))

    // Aguarda a query ser chamada com os novos filtros
    await vi.waitFor(() => {
      const lastCall = spy.mock.calls[spy.mock.calls.length - 1]?.[0]
      expect(lastCall?.search).toBe('cliente')
      expect(lastCall?.planId).toBe('plano-abc')
    })
  })
})
