import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// ── Mocks — vi.hoisted para garantir disponibilidade antes do hoist ───────────

const { mockToastSuccess, mockToastError, mockInvalidateQueries, mockDeleteRegistro } =
  vi.hoisted(() => ({
    mockToastSuccess: vi.fn(),
    mockToastError: vi.fn(),
    mockInvalidateQueries: vi.fn(),
    mockDeleteRegistro: vi.fn(),
  }))

vi.mock('../../../components/ui/Toast', () => ({
  useToast: () => ({
    success: mockToastSuccess,
    error: mockToastError,
    info: vi.fn(),
  }),
}))

vi.mock('../../../utils/handleApiError', () => ({
  handleApiError: (err: unknown) => {
    if (err instanceof Error) return err.message
    return 'Ocorreu um erro inesperado.'
  },
}))

vi.mock('../services/sincronizadorService', () => ({
  deleteRegistro: mockDeleteRegistro,
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

import { useDeleteRegistro } from './useDeleteRegistro'

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  })
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children)
}

describe('useDeleteRegistro', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sucesso → toast.success chamado', async () => {
    mockDeleteRegistro.mockResolvedValueOnce(undefined)

    const { result } = renderHook(() => useDeleteRegistro(), { wrapper: createWrapper() })

    act(() => {
      result.current.mutate({ tipo: 'ticket', hubspotId: '123' })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockToastSuccess).toHaveBeenCalledWith('Registro desativado com sucesso.')
  })

  it('sucesso → query sincronizador-registros é invalidada', async () => {
    mockDeleteRegistro.mockResolvedValueOnce(undefined)

    const { result } = renderHook(() => useDeleteRegistro(), { wrapper: createWrapper() })

    act(() => {
      result.current.mutate({ tipo: 'projeto', hubspotId: '456' })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['sincronizador-registros'] })
  })

  it('sucesso → callback onSuccess é chamado', async () => {
    mockDeleteRegistro.mockResolvedValueOnce(undefined)
    const onSuccess = vi.fn()

    const { result } = renderHook(() => useDeleteRegistro(onSuccess), {
      wrapper: createWrapper(),
    })

    act(() => {
      result.current.mutate({ tipo: 'ticket', hubspotId: '789' })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(onSuccess).toHaveBeenCalledTimes(1)
  })

  it('erro → toast.error chamado', async () => {
    mockDeleteRegistro.mockRejectedValueOnce(new Error('Registro não encontrado'))

    const { result } = renderHook(() => useDeleteRegistro(), { wrapper: createWrapper() })

    act(() => {
      result.current.mutate({ tipo: 'ticket', hubspotId: '999' })
    })

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(mockToastError).toHaveBeenCalledWith('Registro não encontrado')
  })

  it('erro → callback onSuccess NÃO é chamado', async () => {
    mockDeleteRegistro.mockRejectedValueOnce(new Error('Falhou'))
    const onSuccess = vi.fn()

    const { result } = renderHook(() => useDeleteRegistro(onSuccess), {
      wrapper: createWrapper(),
    })

    act(() => {
      result.current.mutate({ tipo: 'projeto', hubspotId: '001' })
    })

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(onSuccess).not.toHaveBeenCalled()
  })
})
