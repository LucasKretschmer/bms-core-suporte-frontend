/**
 * 121/A2 — `useBillingExceptions`: a `queryKey` inclui TODO parâmetro que muda o
 * resultado.
 *
 * Foi exatamente o defeito da unidade WEB-1: com o período fora da chave, o TanStack
 * Query serve o resultado do filtro anterior e o bug volta em forma de cache, sem erro
 * na tela. Por isso o fake discrimina por params e as asserções são sobre os NÚMEROS
 * devolvidos (literais escritos à mão), não sobre "os params foram enviados".
 *
 * Cardinalidade ASSIMÉTRICA de propósito (rules/tests.md): junho tem 2 exceções,
 * julho tem 5, "todas" tem 9 — com números iguais o teste passaria com a chave errada.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

vi.mock('../../shared/services/reportsService', () => ({
  listBillingExceptions: vi.fn(),
  getBillingExceptionsSummary: vi.fn(),
}))

import {
  getBillingExceptionsSummary,
  listBillingExceptions,
} from '../../shared/services/reportsService'
import { useBillingExceptions, useBillingExceptionsSummary } from './useBillingExceptions'
import type { BillingExceptionsParams } from '../../shared/services/reportsService'
import type {
  BillingExceptionItemDto,
  BillingExceptionsSummaryDto,
} from '../../shared/types/reports'
import type { PaginatedResponse } from '../../../../types/api'

const mocked = vi.mocked(listBillingExceptions)
const mockedSummary = vi.mocked(getBillingExceptionsSummary)

const JUNHO = { from: '2026-06-01', to: '2026-06-30' } as const
const JULHO = { from: '2026-07-01', to: '2026-07-31' } as const

function item(id: number): BillingExceptionItemDto {
  return {
    ticketId: id,
    hubspotTicketId: String(70000 + id),
    assunto: `Chamado ${id}`,
    clientId: 1,
    clienteNome: 'Acme',
    equipe: 'Suporte',
    ownerNome: 'Ana',
    status: 'Fechado',
    statusNome: 'Fechado',
    statusCategoria: 'fechado',
    ultimaAtividadeEm: null,
    segundosPlano: 600,
    segundosFaturado: 0,
    segundosAnalise: 0,
    segundosTotais: 600,
    hubspotUrl: null,
  }
}

function pagina(
  quantidade: number,
  page: number,
): PaginatedResponse<BillingExceptionItemDto> {
  return {
    items: Array.from({ length: quantidade }, (_, i) => item(i + 1)),
    totalCount: quantidade,
    page,
    pageSize: 25,
    totalPages: 1,
  }
}

/**
 * `postergado`: 11 · pageSize 100: 7 · página 2: 3 · Junho: 2 · Julho: 5 ·
 * sem período (todas): 9. Todos DISTINTOS — cardinalidade assimétrica.
 */
function fakeBackend(params: BillingExceptionsParams) {
  if (params.tipo === 'postergado') return Promise.resolve(pagina(11, params.page))
  if (params.pageSize === 100) return Promise.resolve(pagina(7, params.page))
  if (params.page === 2) return Promise.resolve(pagina(3, 2))
  if (params.from === JUNHO.from && params.to === JUNHO.to) {
    return Promise.resolve(pagina(2, 1))
  }
  if (params.from === JULHO.from && params.to === JULHO.to) {
    return Promise.resolve(pagina(5, 1))
  }
  return Promise.resolve(pagina(9, 1))
}

beforeEach(() => {
  vi.clearAllMocks()
  mocked.mockImplementation(fakeBackend)
})

function renderComCacheCompartilhado() {
  // UM só QueryClient entre as renderizações — é o que expõe cache servido por
  // chave insuficiente. Com clients separados, a chave errada passaria batida.
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity, staleTime: Infinity } },
  })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  return wrapper
}

describe('useBillingExceptions — a queryKey discrimina todos os params', () => {
  it('trocar o PERÍODO troca os números (2 em junho, 5 em julho)', async () => {
    const wrapper = renderComCacheCompartilhado()
    const { result, rerender } = renderHook(
      (props: { from: string | null; to: string | null }) => useBillingExceptions(props),
      { wrapper, initialProps: { from: JUNHO.from as string | null, to: JUNHO.to as string | null } },
    )

    await waitFor(() => expect(result.current.data?.totalCount).toBe(2))

    rerender({ from: JULHO.from, to: JULHO.to })
    await waitFor(() => expect(result.current.data?.totalCount).toBe(5))

    // Volta a junho: o cache devolve 2 (não 5) — prova de que as duas entradas coexistem.
    rerender({ from: JUNHO.from, to: JUNHO.to })
    await waitFor(() => expect(result.current.data?.totalCount).toBe(2))
  })

  it('trocar a PÁGINA troca os números (3 na página 2)', async () => {
    const wrapper = renderComCacheCompartilhado()
    const { result, rerender } = renderHook(
      (props: { page: number }) => useBillingExceptions({ from: null, to: null, ...props }),
      { wrapper, initialProps: { page: 1 } },
    )

    await waitFor(() => expect(result.current.data?.totalCount).toBe(9))

    rerender({ page: 2 })
    await waitFor(() => expect(result.current.data?.totalCount).toBe(3))
  })

  it('trocar o PAGESIZE troca os números (7 com pageSize 100)', async () => {
    const wrapper = renderComCacheCompartilhado()
    const { result, rerender } = renderHook(
      (props: { pageSize: number }) =>
        useBillingExceptions({ from: null, to: null, ...props }),
      { wrapper, initialProps: { pageSize: 25 } },
    )

    await waitFor(() => expect(result.current.data?.totalCount).toBe(9))

    rerender({ pageSize: 100 })
    await waitFor(() => expect(result.current.data?.totalCount).toBe(7))
  })

  it('ignorarPeriodo=true OMITE from/to na chamada e devolve o conjunto inteiro (9)', async () => {
    const wrapper = renderComCacheCompartilhado()
    const { result, rerender } = renderHook(
      (props: { ignorarPeriodo: boolean }) =>
        useBillingExceptions({ from: JULHO.from, to: JULHO.to, ...props }),
      { wrapper, initialProps: { ignorarPeriodo: false } },
    )

    await waitFor(() => expect(result.current.data?.totalCount).toBe(5))

    rerender({ ignorarPeriodo: true })
    await waitFor(() => expect(result.current.data?.totalCount).toBe(9))

    const ultimaChamada = mocked.mock.calls.at(-1)![0]
    expect(ultimaChamada.from).toBeNull()
    expect(ultimaChamada.to).toBeNull()
  })

  it('trocar a SEÇÃO (tipo) troca os números (9 em anomalia, 11 em postergado)', async () => {
    const wrapper = renderComCacheCompartilhado()
    const { result, rerender } = renderHook(
      (props: { tipo: 'anomalia' | 'postergado' }) =>
        useBillingExceptions({ from: null, to: null, ...props }),
      { wrapper, initialProps: { tipo: 'anomalia' as const } },
    )

    await waitFor(() => expect(result.current.data?.totalCount).toBe(9))

    rerender({ tipo: 'postergado' })
    await waitFor(() => expect(result.current.data?.totalCount).toBe(11))

    // Volta: as duas entradas de cache coexistem (chave discrimina o tipo).
    rerender({ tipo: 'anomalia' })
    await waitFor(() => expect(result.current.data?.totalCount).toBe(9))
  })

  it('o default é a seção ACIONÁVEL (tipo=anomalia enviado ao backend)', async () => {
    const wrapper = renderComCacheCompartilhado()
    const { result } = renderHook(() => useBillingExceptions({ from: null, to: null }), {
      wrapper,
    })

    await waitFor(() => expect(result.current.data).toBeDefined())
    expect(mocked.mock.calls[0][0].tipo).toBe('anomalia')
  })

  it('envia sortBy/sortDirection default do contrato (segundos desc)', async () => {
    const wrapper = renderComCacheCompartilhado()
    const { result } = renderHook(() => useBillingExceptions({ from: null, to: null }), {
      wrapper,
    })

    await waitFor(() => expect(result.current.data).toBeDefined())

    expect(mocked.mock.calls[0][0]).toMatchObject({
      sortBy: 'segundos',
      sortDirection: 'desc',
      page: 1,
      pageSize: 25,
    })
  })

  it('enabled=false não dispara requisição', () => {
    const wrapper = renderComCacheCompartilhado()
    renderHook(() => useBillingExceptions({ from: null, to: null, enabled: false }), {
      wrapper,
    })

    expect(mocked).not.toHaveBeenCalled()
  })

  it('erro do serviço chega como isError (não como lista vazia)', async () => {
    mocked.mockRejectedValue(new Error('boom'))
    const wrapper = renderComCacheCompartilhado()
    const { result } = renderHook(() => useBillingExceptions({ from: null, to: null }), {
      wrapper,
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.data).toBeUndefined()
  })
})

describe('useBillingExceptionsSummary (F-15) — agregados das duas seções', () => {
  function summary(
    partial: Partial<BillingExceptionsSummaryDto> = {},
  ): BillingExceptionsSummaryDto {
    return {
      anomaliasCount: 3,
      anomaliasSegundos: 6300,
      postergadoCount: 12,
      postergadoSegundos: 54000,
      ...partial,
    }
  }

  it('o período entra na queryKey: trocar o recorte troca os agregados', async () => {
    mockedSummary.mockImplementation(({ from }) =>
      Promise.resolve(
        from === JUNHO.from
          ? summary({ anomaliasCount: 3, postergadoCount: 12 })
          : summary({ anomaliasCount: 8, postergadoCount: 40 }),
      ),
    )

    const wrapper = renderComCacheCompartilhado()
    const { result, rerender } = renderHook(
      (props: { from: string | null; to: string | null }) =>
        useBillingExceptionsSummary(props),
      {
        wrapper,
        initialProps: { from: JUNHO.from as string | null, to: JUNHO.to as string | null },
      },
    )

    await waitFor(() => expect(result.current.data?.anomaliasCount).toBe(3))
    expect(result.current.data?.postergadoCount).toBe(12)

    rerender({ from: JULHO.from, to: JULHO.to })
    await waitFor(() => expect(result.current.data?.anomaliasCount).toBe(8))
    expect(result.current.data?.postergadoCount).toBe(40)

    rerender({ from: JUNHO.from, to: JUNHO.to })
    await waitFor(() => expect(result.current.data?.anomaliasCount).toBe(3))
  })

  it('enabled=false não dispara requisição', () => {
    mockedSummary.mockResolvedValue(summary())
    const wrapper = renderComCacheCompartilhado()
    renderHook(
      () => useBillingExceptionsSummary({ from: null, to: null, enabled: false }),
      { wrapper },
    )

    expect(mockedSummary).not.toHaveBeenCalled()
  })

  it('erro chega como isError (não como agregados zerados)', async () => {
    mockedSummary.mockRejectedValue(new Error('boom'))
    const wrapper = renderComCacheCompartilhado()
    const { result } = renderHook(
      () => useBillingExceptionsSummary({ from: null, to: null }),
      { wrapper },
    )

    await waitFor(() => expect(result.current.isError).toBe(true))
    // Zerar em erro afirmaria "nada exige ação" quando a verdade é "não sei".
    expect(result.current.data).toBeUndefined()
  })
})
