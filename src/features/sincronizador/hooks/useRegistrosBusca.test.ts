import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// ── Mocks — vi.hoisted para garantir disponibilidade antes do hoist ───────────

const { mockListRegistros } = vi.hoisted(() => ({
  mockListRegistros: vi.fn(),
}))

vi.mock('../services/sincronizadorService', () => ({
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

  it('query.fetchStatus é "idle" no estado inicial (submitted=false)', () => {
    const { result } = renderHook(() => useRegistrosBusca(), { wrapper: createWrapper() })
    // enabled=false → fetchStatus será idle
    expect(result.current.query.fetchStatus).toBe('idle')
    expect(mockListRegistros).not.toHaveBeenCalled()
  })

  it('query não ativa com busca de 1 caractere (length < 2)', () => {
    const { result } = renderHook(() => useRegistrosBusca(), { wrapper: createWrapper() })

    act(() => {
      result.current.handleBusca('a')
    })

    // enabled=false pois busca.length < 2
    expect(result.current.query.fetchStatus).toBe('idle')
    expect(mockListRegistros).not.toHaveBeenCalled()
  })

  it('query ativa após handleBusca com valor >= 2 chars', async () => {
    mockListRegistros.mockResolvedValueOnce([])

    const { result } = renderHook(() => useRegistrosBusca(), { wrapper: createWrapper() })

    act(() => {
      result.current.handleBusca('ticket')
    })

    await waitFor(() => expect(result.current.query.fetchStatus).toBe('idle'))

    expect(mockListRegistros).toHaveBeenCalledWith({ busca: 'ticket' })
  })

  it('reset() limpa busca e desativa query', async () => {
    mockListRegistros.mockResolvedValueOnce([])

    const { result } = renderHook(() => useRegistrosBusca(), { wrapper: createWrapper() })

    act(() => {
      result.current.handleBusca('teste')
    })

    await waitFor(() => expect(mockListRegistros).toHaveBeenCalledTimes(1))

    act(() => {
      result.current.reset()
    })

    expect(result.current.busca).toBe('')
    // Após reset submitted=false → fetchStatus idle
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
    const registros = [
      {
        hubspotId: '111',
        tipo: 'ticket' as const,
        assunto: 'Assunto teste',
        status: 'aberto',
        clienteNome: null,
        criadoem: '2026-01-01T00:00:00Z',
        desativadoem: null,
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
