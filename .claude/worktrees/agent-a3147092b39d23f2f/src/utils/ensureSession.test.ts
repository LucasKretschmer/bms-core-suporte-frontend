import { describe, expect, it, vi, beforeEach } from 'vitest'

// Mock do service de refresh e do tokenStore — sem HTTP real
vi.mock('../features/auth/services/authService', () => ({
  refresh: vi.fn(),
}))
vi.mock('./tokenStore', () => ({
  tokenStore: {
    set: vi.fn(),
    get: vi.fn(),
    clear: vi.fn(),
    isValid: vi.fn(),
  },
}))

import { refresh } from '../features/auth/services/authService'
import { tokenStore } from './tokenStore'
import { ensureSession, resetSession } from './ensureSession'
import type { AuthUser, LoginResponse } from '../features/auth/types/authSchema'

const mockUser: AuthUser = {
  id: 'user-id-123',
  nome: 'Ana Silva',
  email: 'ana@exemplo.com',
  role: 'ATENDENTE',
  hubspotOwnerId: 42,
  primaryTeamId: 'team-abc',
}

const mockLoginResponse: LoginResponse = {
  token: 'novo-access-token',
  expiresAt: new Date(Date.now() + 900_000).toISOString(),
  user: mockUser,
}

describe('ensureSession', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetSession()
  })

  it('(a) tokenStore válido → resolve sem chamar refresh', async () => {
    vi.mocked(tokenStore.isValid).mockReturnValue(true)

    const result = await ensureSession()

    expect(refresh).not.toHaveBeenCalled()
    expect(result).toBeNull() // sem lastUser cacheado ainda
  })

  it('(b) sucesso → seta tokenStore e retorna o user (shape real)', async () => {
    vi.mocked(tokenStore.isValid).mockReturnValue(false)
    vi.mocked(refresh).mockResolvedValueOnce(mockLoginResponse)

    const result = await ensureSession()

    expect(tokenStore.set).toHaveBeenCalledWith(
      mockLoginResponse.token,
      mockLoginResponse.expiresAt,
    )
    expect(result).toEqual(mockUser)
  })

  it('(c) 401 → limpa tokenStore, retorna null (não lança)', async () => {
    vi.mocked(tokenStore.isValid).mockReturnValue(false)
    vi.mocked(refresh).mockRejectedValueOnce(new Error('401'))

    const result = await ensureSession()

    expect(result).toBeNull()
    expect(tokenStore.clear).toHaveBeenCalled()
  })

  it('(d) memoização: 2 chamadas concorrentes → refresh chamado 1 vez', async () => {
    vi.mocked(tokenStore.isValid).mockReturnValue(false)
    vi.mocked(refresh).mockResolvedValue(mockLoginResponse)

    const [r1, r2] = await Promise.all([ensureSession(), ensureSession()])

    expect(refresh).toHaveBeenCalledTimes(1)
    expect(r1).toEqual(mockUser)
    expect(r2).toEqual(mockUser)
  })

  it('(e) após sucesso, com tokenStore válido devolve lastUser cacheado (sem novo refresh)', async () => {
    vi.mocked(tokenStore.isValid).mockReturnValueOnce(false)
    vi.mocked(refresh).mockResolvedValueOnce(mockLoginResponse)
    await ensureSession() // popula lastUser

    vi.mocked(tokenStore.isValid).mockReturnValue(true)
    const result = await ensureSession()

    expect(refresh).toHaveBeenCalledTimes(1)
    expect(result).toEqual(mockUser)
  })

  it('(f) resetSession() zera lastUser e inflight', async () => {
    vi.mocked(tokenStore.isValid).mockReturnValueOnce(false)
    vi.mocked(refresh).mockResolvedValueOnce(mockLoginResponse)
    await ensureSession()

    resetSession()

    vi.mocked(tokenStore.isValid).mockReturnValue(true)
    const result = await ensureSession()

    expect(result).toBeNull() // lastUser foi zerado
  })
})
