import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockToastSuccess,
  mockToastError,
  mockInvalidateQueries,
  mockCreate,
  mockToggle,
  mockDelete,
} = vi.hoisted(() => ({
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
  mockInvalidateQueries: vi.fn(),
  mockCreate: vi.fn(),
  mockToggle: vi.fn(),
  mockDelete: vi.fn(),
}))

vi.mock('../../../components/ui/Toast', () => ({
  useToast: () => ({ success: mockToastSuccess, error: mockToastError, info: vi.fn() }),
}))

vi.mock('../../../utils/handleApiError', () => ({
  handleApiError: (err: unknown) => (err instanceof Error ? err.message : 'erro'),
}))

vi.mock('../services/serviceCategoriesService', () => ({
  createServiceCategory: mockCreate,
  toggleServiceCategory: mockToggle,
  deleteServiceCategory: mockDelete,
}))

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>()
  return { ...actual, useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }) }
})

import { useCategoryMutations } from './useCategoryMutations'

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children)
}

describe('useCategoryMutations', () => {
  beforeEach(() => vi.clearAllMocks())

  it('create: sucesso → toast e invalida lista', async () => {
    mockCreate.mockResolvedValueOnce({ id: 1, nome: 'X', isActive: true })
    const { result } = renderHook(() => useCategoryMutations(), { wrapper: createWrapper() })

    act(() => result.current.create.mutate('X'))
    await waitFor(() => expect(result.current.create.isSuccess).toBe(true))

    expect(mockToastSuccess).toHaveBeenCalledWith('Categoria adicionada.')
    expect(mockInvalidateQueries).toHaveBeenCalled()
  })

  it('toggleActive: ativar → toast "Categoria ativada."', async () => {
    mockToggle.mockResolvedValueOnce({ id: 1, nome: 'X', isActive: true })
    const { result } = renderHook(() => useCategoryMutations(), { wrapper: createWrapper() })

    act(() => result.current.toggleActive.mutate({ id: 1, isActive: true }))
    await waitFor(() => expect(result.current.toggleActive.isSuccess).toBe(true))

    expect(mockToggle).toHaveBeenCalledWith(1, true)
    expect(mockToastSuccess).toHaveBeenCalledWith('Categoria ativada.')
  })

  it('toggleActive: desativar → toast "Categoria desativada."', async () => {
    mockToggle.mockResolvedValueOnce({ id: 'c-1', nome: 'X', isActive: false })
    const { result } = renderHook(() => useCategoryMutations(), { wrapper: createWrapper() })

    act(() => result.current.toggleActive.mutate({ id: 1, isActive: false }))
    await waitFor(() => expect(result.current.toggleActive.isSuccess).toBe(true))

    expect(mockToastSuccess).toHaveBeenCalledWith('Categoria desativada.')
  })

  it('remove: erro → toast.error', async () => {
    mockDelete.mockRejectedValueOnce(new Error('Categoria em uso'))
    const { result } = renderHook(() => useCategoryMutations(), { wrapper: createWrapper() })

    act(() => result.current.remove.mutate(1))
    await waitFor(() => expect(result.current.remove.isError).toBe(true))

    expect(mockToastError).toHaveBeenCalledWith('Categoria em uso')
  })
})
