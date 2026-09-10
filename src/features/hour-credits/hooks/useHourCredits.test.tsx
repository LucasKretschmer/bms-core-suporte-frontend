import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockList } = vi.hoisted(() => ({ mockList: vi.fn() }))
vi.mock('../services/hourCreditsService', () => ({ listHourCredits: mockList }))

import { useHourCredits } from './useHourCredits'

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

const RESPOSTA = { items: [], totalCount: 0, page: 1, pageSize: 25, totalPages: 0 }

describe('useHourCredits', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockList.mockResolvedValue(RESPOSTA)
  })

  it('🔴 a ordenação inicial é `criadoem desc` — nome da whitelist do backend', async () => {
    // Literal escrito à mão. `sortBy` fora da whitelist devolve `400` na borda
    // (`analise-backend.md` §7.2), e o default errado quebraria a tela na PRIMEIRA carga.
    renderHook(() => useHourCredits(), { wrapper })

    await waitFor(() => expect(mockList).toHaveBeenCalled())
    expect(mockList.mock.calls[0][0]).toMatchObject({
      sortBy: 'criadoem',
      sortDirection: 'desc',
      page: 1,
      pageSize: 25,
    })
  })

  it('os filtros iniciais são "sem filtro" — nenhum recorte implícito', async () => {
    // Um default oculto (ex.: `status: ['vigente']`) esconderia créditos estornados sem
    // que nada na tela dissesse isso.
    renderHook(() => useHourCredits(), { wrapper })

    await waitFor(() => expect(mockList).toHaveBeenCalled())
    const params = mockList.mock.calls[0][0]
    expect(params.status).toEqual([])
    expect(params.clientId).toBeNull()
    expect(params.competencia).toBeNull()
    expect(params.origem).toBeNull()
    expect(params.search).toBe('')
  })

  it('mudar filtro dispara nova busca com o valor — e volta para a página 1', async () => {
    const { result } = renderHook(() => useHourCredits(), { wrapper })
    await waitFor(() => expect(mockList).toHaveBeenCalledTimes(1))

    result.current.setPage(3)
    await waitFor(() => expect(mockList).toHaveBeenCalledTimes(2))
    result.current.setFilters({ status: ['estornado'] })

    await waitFor(() => expect(mockList).toHaveBeenCalledTimes(3))
    const ultima = mockList.mock.calls[2][0]
    expect(ultima.status).toEqual(['estornado'])
    // Sem o reset de página, filtrar na página 3 devolveria "nenhum resultado" para um
    // conjunto que tem uma página só.
    expect(ultima.page).toBe(1)
  })
})
