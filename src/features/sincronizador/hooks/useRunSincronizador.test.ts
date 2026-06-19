import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// ── Mocks — usar vi.hoisted para garantir que as fns existam antes do hoist ───

const { mockToastInfo, mockToastError, mockInvalidateQueries, mockRunSincronizador } =
  vi.hoisted(() => ({
    mockToastInfo: vi.fn(),
    mockToastError: vi.fn(),
    mockInvalidateQueries: vi.fn(),
    mockRunSincronizador: vi.fn(),
  }))

vi.mock('../../../components/ui/Toast', () => ({
  useToast: () => ({
    info: mockToastInfo,
    error: mockToastError,
    success: vi.fn(),
  }),
}))

vi.mock('../../../utils/handleApiError', () => ({
  handleApiError: (err: unknown) => {
    if (err instanceof Error) return err.message
    return 'Ocorreu um erro inesperado.'
  },
}))

vi.mock('../services/sincronizadorService', () => ({
  runSincronizador: mockRunSincronizador,
}))

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>()
  return {
    ...actual,
    useQueryClient: () => ({
      invalidateQueries: mockInvalidateQueries,
    }),
  }
})

// Mock do isAxiosError para controlar o 409
vi.mock('axios', async (importOriginal) => {
  const actual = await importOriginal<typeof import('axios')>()
  return {
    ...actual,
    isAxiosError: (err: unknown): boolean =>
      typeof err === 'object' &&
      err !== null &&
      (err as Record<string, unknown>).isAxiosError === true,
  }
})

import { useRunSincronizador } from './useRunSincronizador'

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  })
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children)
}

describe('useRunSincronizador', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sucesso → toast.info chamado com mensagem de iniciada', async () => {
    mockRunSincronizador.mockResolvedValueOnce({ logId: 'abc', status: 'executando' })

    const { result } = renderHook(() => useRunSincronizador(), { wrapper: createWrapper() })

    act(() => {
      result.current.mutate()
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockToastInfo).toHaveBeenCalledWith('Sincronização iniciada.')
  })

  it('sucesso → invalida sincronizador-status e sincronizador-logs', async () => {
    mockRunSincronizador.mockResolvedValueOnce({ logId: 'abc', status: 'executando' })

    const { result } = renderHook(() => useRunSincronizador(), { wrapper: createWrapper() })

    act(() => {
      result.current.mutate()
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['sincronizador-status'] })
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['sincronizador-logs'] })
  })

  it('erro 409 → toast.error com "Sincronização já em andamento."', async () => {
    const axiosError = Object.assign(new Error('Conflict'), {
      isAxiosError: true,
      response: { status: 409, data: {} },
    })
    mockRunSincronizador.mockRejectedValueOnce(axiosError)

    const { result } = renderHook(() => useRunSincronizador(), { wrapper: createWrapper() })

    act(() => {
      result.current.mutate()
    })

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(mockToastError).toHaveBeenCalledWith('Sincronização já em andamento.')
  })

  it('erro genérico → toast.error com mensagem do erro', async () => {
    mockRunSincronizador.mockRejectedValueOnce(new Error('Servidor indisponível'))

    const { result } = renderHook(() => useRunSincronizador(), { wrapper: createWrapper() })

    act(() => {
      result.current.mutate()
    })

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(mockToastError).toHaveBeenCalledWith('Servidor indisponível')
  })
})
