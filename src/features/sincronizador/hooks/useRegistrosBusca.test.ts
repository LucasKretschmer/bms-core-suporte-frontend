import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { RegistroDto } from '../types/sincronizador'

// ── Mocks — vi.hoisted para garantir disponibilidade antes do hoist ───────────

const { mockListRegistros } = vi.hoisted(() => ({
  mockListRegistros: vi.fn(),
}))

vi.mock('../services/sincronizadorService', () => ({
  // buildBuscaParams é usado pelo hook — re-exportamos a implementação real
  buildBuscaParams: (termo: string) =>
    /^\d+$/.test(termo.trim()) ? { hubspotId: termo.trim() } : { search: termo.trim() },
  listRegistros: mockListRegistros,
}))

import { useRegistrosBusca } from './useRegistrosBusca'

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children)
}

describe('useRegistrosBusca', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('query fica idle no estado inicial (submitted=false)', () => {
    const { result } = renderHook(() => useRegistrosBusca(), { wrapper: createWrapper() })
    expect(result.current.query.fetchStatus).toBe('idle')
    expect(mockListRegistros).not.toHaveBeenCalled()
  })

  it('query não ativa com termo de 1 caractere (length < 2)', () => {
    const { result } = renderHook(() => useRegistrosBusca(), { wrapper: createWrapper() })

    act(() => {
      result.current.handleBusca('a')
    })

    expect(result.current.query.fetchStatus).toBe('idle')
    expect(mockListRegistros).not.toHaveBeenCalled()
  })

  it('termo textual >= 2 chars → chama listRegistros com { search }', async () => {
    mockListRegistros.mockResolvedValueOnce([])

    const { result } = renderHook(() => useRegistrosBusca(), { wrapper: createWrapper() })

    act(() => {
      result.current.handleBusca('ticket')
    })

    await waitFor(() => expect(mockListRegistros).toHaveBeenCalledTimes(1))
    expect(mockListRegistros).toHaveBeenCalledWith({ search: 'ticket' })
  })

  it('termo numérico → chama listRegistros com { hubspotId }', async () => {
    mockListRegistros.mockResolvedValueOnce([])

    const { result } = renderHook(() => useRegistrosBusca(), { wrapper: createWrapper() })

    act(() => {
      result.current.handleBusca('123456')
    })

    await waitFor(() => expect(mockListRegistros).toHaveBeenCalledTimes(1))
    expect(mockListRegistros).toHaveBeenCalledWith({ hubspotId: '123456' })
  })

  it('reset() limpa termo e desativa query', async () => {
    mockListRegistros.mockResolvedValueOnce([])

    const { result } = renderHook(() => useRegistrosBusca(), { wrapper: createWrapper() })

    act(() => {
      result.current.handleBusca('teste')
    })

    await waitFor(() => expect(mockListRegistros).toHaveBeenCalledTimes(1))

    act(() => {
      result.current.reset()
    })

    expect(result.current.termo).toBe('')
    expect(result.current.query.fetchStatus).toBe('idle')
  })

  it('query.isError quando service rejeita', async () => {
    mockListRegistros.mockRejectedValueOnce(new Error('Falhou'))

    const { result } = renderHook(() => useRegistrosBusca(), { wrapper: createWrapper() })

    act(() => {
      result.current.handleBusca('busca')
    })

    await waitFor(() => expect(result.current.query.isError).toBe(true))
  })

  it('retorna os dados do service quando bem-sucedido', async () => {
    const registros: RegistroDto[] = [
      {
        tipo: 'ticket',
        hubspotId: '111',
        assunto: 'Assunto teste',
        pipeline: 'Suporte',
        criadoEm: '2026-01-01T00:00:00Z',
      },
    ]
    mockListRegistros.mockResolvedValueOnce(registros)

    const { result } = renderHook(() => useRegistrosBusca(), { wrapper: createWrapper() })

    act(() => {
      result.current.handleBusca('111')
    })

    await waitFor(() => expect(result.current.query.isSuccess).toBe(true))

    expect(result.current.query.data).toEqual(registros)
  })
})
