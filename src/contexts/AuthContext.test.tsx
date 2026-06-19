import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import React from 'react'
import { AuthProvider, useAuthContext } from './AuthContext'
import { tokenStore } from '../utils/tokenStore'
import type { AuthUser, LoginResponse } from '../features/auth/types/authSchema'

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockNavigate = vi.fn()

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mockNavigate,
}))

// Mock do authService para controlar o comportamento nos testes
vi.mock('../features/auth/services/authService', () => ({
  login: vi.fn(),
  logout: vi.fn(),
}))

import * as authService from '../features/auth/services/authService'

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
  })

  it('estado inicial: user é null e isAuthenticated é false', () => {
    const { result } = renderHook(() => useAuthContext(), { wrapper })

    expect(result.current.user).toBeNull()
    expect(result.current.isAuthenticated).toBe(false)
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

  it('logout limpa tokenStore', async () => {
    // Primeiro, faz login para ter token
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

    expect(tokenStore.isValid()).toBe(false)
    expect(tokenStore.get()).toBeNull()
  })

  it('logout define user como null', async () => {
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

  it('logout redireciona para /login', async () => {
    vi.mocked(authService.login).mockResolvedValueOnce(mockLoginResponse)
    vi.mocked(authService.logout).mockResolvedValueOnce(undefined)

    const { result } = renderHook(() => useAuthContext(), { wrapper })

    await act(async () => {
      await result.current.login('carlos@empresa.com', 'senha123')
    })

    await act(async () => {
      await result.current.logout()
    })

    expect(mockNavigate).toHaveBeenCalledWith({ to: '/login' })
  })

  it('evento auth:logout limpa tokenStore e estado', async () => {
    vi.mocked(authService.login).mockResolvedValueOnce(mockLoginResponse)
    vi.mocked(authService.logout).mockResolvedValueOnce(undefined)

    const { result } = renderHook(() => useAuthContext(), { wrapper })

    await act(async () => {
      await result.current.login('carlos@empresa.com', 'senha123')
    })

    expect(result.current.isAuthenticated).toBe(true)

    // Simula o evento emitido pelo interceptor Axios em caso de 401
    act(() => {
      window.dispatchEvent(new Event('auth:logout'))
    })

    await waitFor(() => {
      expect(result.current.user).toBeNull()
      expect(tokenStore.isValid()).toBe(false)
    })
  })

  it('useAuthContext lança erro quando usado fora do AuthProvider', () => {
    // Renderiza sem wrapper = sem AuthProvider
    expect(() => {
      renderHook(() => useAuthContext())
    }).toThrow('useAuthContext deve ser usado dentro de <AuthProvider>')
  })
})
