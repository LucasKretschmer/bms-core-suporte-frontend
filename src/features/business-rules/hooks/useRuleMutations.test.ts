import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockToastSuccess, mockToastError, mockInvalidateQueries, mockSave } = vi.hoisted(() => ({
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
  mockInvalidateQueries: vi.fn(),
  mockSave: vi.fn(),
}))

vi.mock('../../../components/ui/Toast', () => ({
  useToast: () => ({ success: mockToastSuccess, error: mockToastError, info: vi.fn() }),
}))

vi.mock('../../../utils/handleApiError', () => ({
  handleApiError: (err: unknown) => (err instanceof Error ? err.message : 'erro'),
}))

vi.mock('../services/businessRulesService', () => ({ saveBusinessRule: mockSave }))

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>()
  return { ...actual, useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }) }
})

import { useRuleMutations } from './useRuleMutations'

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children)
}

describe('useRuleMutations', () => {
  beforeEach(() => vi.clearAllMocks())

  it('sucesso (equipe) → toast "Salvo." e invalida a query da equipe', async () => {
    mockSave.mockResolvedValueOnce({ id: 'r-1' })
    const { result } = renderHook(() => useRuleMutations(), { wrapper: createWrapper() })

    act(() =>
      result.current.mutate({ ruleId: null, teamId: 't-1', chave: 'allowEditTimes', valor: true }),
    )
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockToastSuccess).toHaveBeenCalledWith('Salvo.')
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['business-rules', 'team', 't-1'],
    })
  })

  it('sucesso (global) → invalida a query global', async () => {
    mockSave.mockResolvedValueOnce({ id: 'r-2' })
    const { result } = renderHook(() => useRuleMutations(), { wrapper: createWrapper() })

    act(() =>
      result.current.mutate({ ruleId: null, teamId: null, chave: 'idleAlertMinutes', valor: 10 }),
    )
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['business-rules', 'global'] })
  })

  it('erro → toast.error com handleApiError', async () => {
    mockSave.mockRejectedValueOnce(new Error('falhou'))
    const { result } = renderHook(() => useRuleMutations(), { wrapper: createWrapper() })

    act(() =>
      result.current.mutate({ ruleId: 'r-1', teamId: 't-1', chave: 'allowEditTimes', valor: true }),
    )
    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(mockToastError).toHaveBeenCalledWith('falhou')
  })
})
