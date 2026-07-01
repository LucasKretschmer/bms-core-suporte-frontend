import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// ── Mocks — vi.hoisted para garantir disponibilidade antes do hoist ───────────

const { mockToastSuccess, mockToastError, mockSyncEmpresas } = vi.hoisted(() => ({
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
  mockSyncEmpresas: vi.fn(),
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
  syncEmpresas: mockSyncEmpresas,
}))

import { useSyncEmpresas } from './useSyncEmpresas'

function createClient() {
  return new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  })
}

function createWrapper(client: QueryClient = createClient()) {
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client }, children)
}

describe('useSyncEmpresas', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sucesso → toast.success com resumo (criadas/atualizadas/removidas)', async () => {
    mockSyncEmpresas.mockResolvedValueOnce({ criadas: 5, atualizadas: 3, desativadas: 1 })

    const { result } = renderHook(() => useSyncEmpresas(), { wrapper: createWrapper() })

    act(() => {
      result.current.mutate()
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockToastSuccess).toHaveBeenCalledWith(
      expect.stringContaining('5 criada(s)'),
    )
    expect(mockToastSuccess).toHaveBeenCalledWith(
      expect.stringContaining('3 atualizada(s)'),
    )
    expect(mockToastSuccess).toHaveBeenCalledWith(
      expect.stringContaining('1 removida(s)'),
    )
  })

  it('resumo com zeros ainda é reportado no toast', async () => {
    mockSyncEmpresas.mockResolvedValueOnce({ criadas: 0, atualizadas: 0, desativadas: 0 })

    const { result } = renderHook(() => useSyncEmpresas(), { wrapper: createWrapper() })

    act(() => {
      result.current.mutate()
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockToastSuccess).toHaveBeenCalledWith(
      expect.stringContaining('0 criada(s)'),
    )
    expect(mockToastError).not.toHaveBeenCalled()
  })

  it('erro → toast.error com a mensagem do erro', async () => {
    mockSyncEmpresas.mockRejectedValueOnce(new Error('Falha ao buscar empresas'))

    const { result } = renderHook(() => useSyncEmpresas(), { wrapper: createWrapper() })

    act(() => {
      result.current.mutate()
    })

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(mockToastError).toHaveBeenCalledWith('Falha ao buscar empresas')
    expect(mockToastSuccess).not.toHaveBeenCalled()
  })

  it('isPending=false quando não há mutation em andamento', () => {
    const { result } = renderHook(() => useSyncEmpresas(), { wrapper: createWrapper() })
    expect(result.current.isPending).toBe(false)
  })

  it('sucesso → invalida a query dos logs do sincronizador (088)', async () => {
    mockSyncEmpresas.mockResolvedValueOnce({ criadas: 2, atualizadas: 1, desativadas: 0 })
    const client = createClient()
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries')

    const { result } = renderHook(() => useSyncEmpresas(), {
      wrapper: createWrapper(client),
    })

    act(() => {
      result.current.mutate()
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['sincronizador-logs'],
    })
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['sincronizador-status'],
    })
  })

  it('erro → NÃO invalida as queries', async () => {
    mockSyncEmpresas.mockRejectedValueOnce(new Error('Falha'))
    const client = createClient()
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries')

    const { result } = renderHook(() => useSyncEmpresas(), {
      wrapper: createWrapper(client),
    })

    act(() => {
      result.current.mutate()
    })

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(invalidateSpy).not.toHaveBeenCalled()
  })
})
