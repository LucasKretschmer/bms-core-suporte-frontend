import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockToastSuccess, mockToastError, mockInvalidateQueries, mockUpdateAgentRole } =
  vi.hoisted(() => ({
    mockToastSuccess: vi.fn(),
    mockToastError: vi.fn(),
    mockInvalidateQueries: vi.fn(),
    mockUpdateAgentRole: vi.fn(),
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

vi.mock('../services/teamsService', () => ({
  updateAgentRole: mockUpdateAgentRole,
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

import { useUpdateAgentRole } from './useUpdateAgentRole'
import { TEAM_MEMBERS_QUERY_KEY } from './useTeamMembers'

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  })
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children)
}

describe('useUpdateAgentRole', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('mapeia perfil "gestor" → role 3 (Gerente) ao chamar o service', async () => {
    mockUpdateAgentRole.mockResolvedValueOnce({})

    const { result } = renderHook(() => useUpdateAgentRole(), { wrapper: createWrapper() })

    act(() => {
      result.current.mutate({ userId: 10, profile: 'gestor' })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockUpdateAgentRole).toHaveBeenCalledWith(10, 3)
  })

  it('mapeia perfil "atendente" → role 1 (Atendente) ao chamar o service', async () => {
    mockUpdateAgentRole.mockResolvedValueOnce({})

    const { result } = renderHook(() => useUpdateAgentRole(), { wrapper: createWrapper() })

    act(() => {
      result.current.mutate({ userId: 11, profile: 'atendente' })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockUpdateAgentRole).toHaveBeenCalledWith(11, 1)
  })

  it('sucesso → toast.success e invalida a lista de atendentes', async () => {
    mockUpdateAgentRole.mockResolvedValueOnce({})

    const { result } = renderHook(() => useUpdateAgentRole(), { wrapper: createWrapper() })

    act(() => {
      result.current.mutate({ userId: 1, profile: 'gestor' })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockToastSuccess).toHaveBeenCalledWith('Perfil do atendente atualizado com sucesso.')
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: TEAM_MEMBERS_QUERY_KEY })
  })

  it('erro (ex: 403) → toast.error e NÃO invalida a lista', async () => {
    mockUpdateAgentRole.mockRejectedValueOnce(
      new Error('Você não tem permissão para realizar esta ação.'),
    )

    const { result } = renderHook(() => useUpdateAgentRole(), { wrapper: createWrapper() })

    act(() => {
      result.current.mutate({ userId: 1, profile: 'gestor' })
    })

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(mockToastError).toHaveBeenCalledWith('Você não tem permissão para realizar esta ação.')
    expect(mockInvalidateQueries).not.toHaveBeenCalled()
  })
})
