import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import React from 'react'

// ── Mocks ────────────────────────────────────────────────────────────────────
// O AuthProvider navega via instância singleton `router` (não useNavigate),
// limpa o cache via `queryClient` e reidrata a sessão via `ensureSession`.
// Mockamos esses módulos reais — nunca o `@tanstack/react-router` parcialmente
// (apagar `createRootRoute` quebra o import de `../router` → routeTree.gen).

vi.mock('../router', () => ({
  router: { navigate: vi.fn() },
}))

vi.mock('../queryClient', () => ({
  queryClient: { clear: vi.fn() },
}))

vi.mock('../utils/ensureSession', () => ({
  ensureSession: vi.fn(),
  resetSession: vi.fn(),
}))

vi.mock('../features/auth/services/authService', () => ({
  login: vi.fn(),
  logout: vi.fn(),
  refresh: vi.fn(),
}))

import { AuthProvider, useAuthContext } from './AuthContext'
import { tokenStore } from '../utils/tokenStore'
import { router } from '../router'
import { queryClient } from '../queryClient'
import { ensureSession, resetSession } from '../utils/ensureSession'
import * as authService from '../features/auth/services/authService'
import type { AuthUser, LoginResponse } from '../features/auth/types/authSchema'

// ── Dados de teste ────────────────────────────────────────────────────────────

const mockUser: AuthUser = {
  id: 'user-abc',
  nome: 'Carlos Pereira',
  email: 'carlos@empresa.com',
  role: 'COORDENADOR',
  hubspotOwnerId: 10,
  primaryTeamId: null,
}

const futureExpiry = new Date(Date.now() + 3_600_000).toISOString()

const mockLoginResponse: LoginResponse = {
  token: 'jwt-token-valido',
  expiresAt: futureExpiry,
  user: mockUser,
}

function wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(AuthProvider, null, children)
}

// ── Testes ────────────────────────────────────────────────────────────────────

describe('AuthContext', () => {
  beforeEach(() => {
    tokenStore.clear()
    vi.clearAllMocks()
    // Por padrão, o rehydrate no mount não reidrata nada (sem sessão).
    vi.mocked(ensureSession).mockResolvedValue(null)
  })

  it('estado inicial: user é null e isAuthenticated é false', async () => {
    const { result } = renderHook(() => useAuthContext(), { wrapper })

    expect(result.current.user).toBeNull()
    expect(result.current.isAuthenticated).toBe(false)

    // Aguarda o bootstrap concluir para não vazar estado entre testes.
    await waitFor(() => expect(result.current.isBootstrapping).toBe(false))
  })

  it('login guarda token no tokenStore', async () => {
    vi.mocked(authService.login).mockResolvedValueOnce(mockLoginResponse)

    const { result } = renderHook(() => useAuthContext(), { wrapper })

    await act(async () => {
      await result.current.login('carlos@empresa.com', 'senha123')
    })

    expect(tokenStore.isValid()).toBe(true)
    expect(tokenStore.get()).toBe('jwt-token-valido')
  })

  it('login atualiza user no estado React', async () => {
    vi.mocked(authService.login).mockResolvedValueOnce(mockLoginResponse)

    const { result } = renderHook(() => useAuthContext(), { wrapper })

    await act(async () => {
      await result.current.login('carlos@empresa.com', 'senha123')
    })

    expect(result.current.user).toEqual(mockUser)
    expect(result.current.isAuthenticated).toBe(true)
  })

  it('logout chama authService.logout, limpa tokenStore, resetSession, queryClient.clear e navega', async () => {
    vi.mocked(authService.login).mockResolvedValueOnce(mockLoginResponse)
    vi.mocked(authService.logout).mockResolvedValueOnce(undefined)

    const { result } = renderHook(() => useAuthContext(), { wrapper })

    await act(async () => {
      await result.current.login('carlos@empresa.com', 'senha123')
    })

    expect(tokenStore.isValid()).toBe(true)

    await act(async () => {
      await result.current.logout()
    })

    expect(authService.logout).toHaveBeenCalledTimes(1)
    expect(tokenStore.isValid()).toBe(false)
    expect(tokenStore.get()).toBeNull()
    expect(resetSession).toHaveBeenCalledTimes(1)
    expect(queryClient.clear).toHaveBeenCalledTimes(1)
    expect(router.navigate).toHaveBeenCalledWith({ to: '/login' })
  })

  it('logout define user como null e isAuthenticated false', async () => {
    vi.mocked(authService.login).mockResolvedValueOnce(mockLoginResponse)
    vi.mocked(authService.logout).mockResolvedValueOnce(undefined)

    const { result } = renderHook(() => useAuthContext(), { wrapper })

    await act(async () => {
      await result.current.login('carlos@empresa.com', 'senha123')
    })

    expect(result.current.user).not.toBeNull()

    await act(async () => {
      await result.current.logout()
    })

    expect(result.current.user).toBeNull()
    expect(result.current.isAuthenticated).toBe(false)
  })

  it('rehydrate no mount: ensureSession retorna user → setUser populado e isBootstrapping vira false', async () => {
    vi.mocked(ensureSession).mockResolvedValueOnce(mockUser)

    const { result } = renderHook(() => useAuthContext(), { wrapper })

    // Antes do efeito assíncrono resolver, ainda está em bootstrap.
    expect(result.current.isBootstrapping).toBe(true)

    await waitFor(() => {
      expect(result.current.user).toEqual(mockUser)
      expect(result.current.isAuthenticated).toBe(true)
      expect(result.current.isBootstrapping).toBe(false)
    })

    expect(ensureSession).toHaveBeenCalledTimes(1)
  })

  it('rehydrate no mount sem sessão: user permanece null e isBootstrapping vira false', async () => {
    vi.mocked(ensureSession).mockResolvedValueOnce(null)

    const { result } = renderHook(() => useAuthContext(), { wrapper })

    await waitFor(() => expect(result.current.isBootstrapping).toBe(false))

    expect(result.current.user).toBeNull()
    expect(result.current.isAuthenticated).toBe(false)
  })

  it('evento auth:logout limpa estado e navega sem chamar authService.logout', async () => {
    vi.mocked(authService.login).mockResolvedValueOnce(mockLoginResponse)

    const { result } = renderHook(() => useAuthContext(), { wrapper })

    await act(async () => {
      await result.current.login('carlos@empresa.com', 'senha123')
    })

    expect(result.current.isAuthenticated).toBe(true)

    // Simula o evento emitido pelo interceptor Axios em caso de 401 esgotado.
    act(() => {
      window.dispatchEvent(new Event('auth:logout'))
    })

    await waitFor(() => {
      expect(result.current.user).toBeNull()
      expect(tokenStore.isValid()).toBe(false)
    })

    // Fallback de refresh esgotado NÃO chama authService.logout.
    expect(authService.logout).not.toHaveBeenCalled()
    expect(resetSession).toHaveBeenCalled()
    expect(queryClient.clear).toHaveBeenCalled()
    expect(router.navigate).toHaveBeenCalledWith({ to: '/login' })
  })

  it('useAuthContext lança erro quando usado fora do AuthProvider', () => {
    // Renderiza sem wrapper = sem AuthProvider
    expect(() => {
      renderHook(() => useAuthContext())
    }).toThrow('useAuthContext deve ser usado dentro de <AuthProvider>')
  })
})
