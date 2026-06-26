import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SincronizadorStatusDto } from '../types/sincronizador'

const { mockGetStatus } = vi.hoisted(() => ({
  mockGetStatus: vi.fn(),
}))

vi.mock('../services/sincronizadorService', () => ({
  getSincronizadorStatus: mockGetStatus,
}))

import { useSincronizadorStatus } from './useSincronizadorStatus'

function makeStatus(overrides?: Partial<SincronizadorStatusDto>): SincronizadorStatusDto {
  return {
    statusSistema: 'online',
    emExecucao: false,
    intervaloMinutos: 2,
    ultimaExecucao: null,
    ...overrides,
  }
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children)
}

describe('useSincronizadorStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('chama o service na montagem e expõe os dados', async () => {
    mockGetStatus.mockResolvedValue(makeStatus({ statusSistema: 'online' }))

    const { result } = renderHook(() => useSincronizadorStatus(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockGetStatus).toHaveBeenCalled()
    expect(result.current.data?.statusSistema).toBe('online')
  })

  it('isError quando o service rejeita', async () => {
    mockGetStatus.mockRejectedValueOnce(new Error('falha'))

    const { result } = renderHook(() => useSincronizadorStatus(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isError).toBe(true))
  })

  it('faz polling: refaz a query ao avançar o intervalo de 5s', async () => {
    vi.useFakeTimers()
    mockGetStatus.mockResolvedValue(makeStatus())

    const { result } = renderHook(() => useSincronizadorStatus(), { wrapper: createWrapper() })

    await vi.waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockGetStatus).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(5_000)

    expect(mockGetStatus.mock.calls.length).toBeGreaterThanOrEqual(2)
  })
})
