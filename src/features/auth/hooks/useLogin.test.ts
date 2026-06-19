import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

// ── Mocks externos ────────────────────────────────────────────────────────────

const mockNavigate = vi.fn()
const mockToastError = vi.fn()
const mockToastSuccess = vi.fn()
const mockLogin = vi.fn()

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mockNavigate,
  useSearch: () => ({ redirect: undefined }),
}))

vi.mock('../../../hooks/useAuth', () => ({
  useAuth: () => ({
    login: mockLogin,
    logout: vi.fn(),
    user: null,
    isAuthenticated: false,
  }),
}))

vi.mock('../../../components/ui/Toast', () => ({
  useToast: () => ({
    error: mockToastError,
    success: mockToastSuccess,
    info: vi.fn(),
  }),
}))

vi.mock('../../../utils/handleApiError', () => ({
  handleApiError: (err: unknown) => {
    if (err instanceof Error) return err.message
    return 'Ocorreu um erro inesperado.'
  },
}))

import { useLogin } from './useLogin'

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  })
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children)
}

describe('useLogin', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('chama authContext.login com email e password', async () => {
    mockLogin.mockResolvedValueOnce(undefined)

    const { result } = renderHook(() => useLogin(), { wrapper: createWrapper() })

    act(() => {
      result.current.mutate({ email: 'ana@exemplo.com', password: 'senha123' })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockLogin).toHaveBeenCalledWith('ana@exemplo.com', 'senha123')
  })

  it('redireciona para "/" ao ter sucesso sem redirect param', async () => {
    mockLogin.mockResolvedValueOnce(undefined)

    const { result } = renderHook(() => useLogin(), { wrapper: createWrapper() })

    act(() => {
      result.current.mutate({ email: 'ana@exemplo.com', password: 'senha123' })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockNavigate).toHaveBeenCalledWith({ to: '/' })
  })

  it('dispara toast de erro ao falhar', async () => {
    mockLogin.mockRejectedValueOnce(new Error('Credenciais inválidas'))

    const { result } = renderHook(() => useLogin(), { wrapper: createWrapper() })

    act(() => {
      result.current.mutate({ email: 'x@x.com', password: 'errada' })
    })

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(mockToastError).toHaveBeenCalledWith('Credenciais inválidas')
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('não navega quando há erro de login', async () => {
    mockLogin.mockRejectedValueOnce(new Error('Servidor indisponível'))

    const { result } = renderHook(() => useLogin(), { wrapper: createWrapper() })

    act(() => {
      result.current.mutate({ email: 'x@x.com', password: 'senha' })
    })

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(mockNavigate).not.toHaveBeenCalled()
  })
})
