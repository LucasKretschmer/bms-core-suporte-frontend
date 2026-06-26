import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// ── Mocks — vi.hoisted para garantir disponibilidade antes do hoist ───────────

const { mockToastSuccess, mockToastError, mockSyncTeams } = vi.hoisted(() => ({
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
  mockSyncTeams: vi.fn(),
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
  syncTeams: mockSyncTeams,
}))

import { useSyncTeams } from './useSyncTeams'

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  })
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children)
}

describe('useSyncTeams', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sucesso com contadores → toast.success com texto dos contadores', async () => {
    mockSyncTeams.mockResolvedValueOnce({ ownersProcessed: 3, teamsProcessed: 2 })

    const { result } = renderHook(() => useSyncTeams(), { wrapper: createWrapper() })

    act(() => {
      result.current.mutate()
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockToastSuccess).toHaveBeenCalledWith(
      expect.stringContaining('3 owner(s)'),
    )
    expect(mockToastSuccess).toHaveBeenCalledWith(
      expect.stringContaining('2 time(s)'),
    )
  })

  it('erro → toast.error chamado com mensagem do erro', async () => {
    mockSyncTeams.mockRejectedValueOnce(new Error('Servidor fora do ar'))

    const { result } = renderHook(() => useSyncTeams(), { wrapper: createWrapper() })

    act(() => {
      result.current.mutate()
    })

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(mockToastError).toHaveBeenCalledWith('Servidor fora do ar')
  })

  it('isPending=false quando não há mutation em andamento', () => {
    const { result } = renderHook(() => useSyncTeams(), { wrapper: createWrapper() })
    expect(result.current.isPending).toBe(false)
  })
})
