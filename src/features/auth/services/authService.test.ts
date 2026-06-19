import { describe, expect, it, vi, beforeEach } from 'vitest'

// Mock da instância centralizada do Axios — nunca chamar HTTP real nos testes
vi.mock('../../../services/api', () => ({
  api: {
    post: vi.fn(),
    get: vi.fn(),
  },
}))

import { api } from '../../../services/api'
import { login, getMe, logout } from './authService'
import type { AuthUser, LoginResponse } from '../types/authSchema'

const mockUser: AuthUser = {
  id: 'user-id-123',
  nome: 'Ana Silva',
  email: 'ana@exemplo.com',
  role: 'ATENDENTE',
  hubspotOwnerId: 42,
  primaryTeamId: 'team-abc',
}

const mockLoginResponse: LoginResponse = {
  token: 'eyJhbGciOiJIUzI1NiJ9.payload.sig',
  expiresAt: new Date(Date.now() + 3600_000).toISOString(),
  user: mockUser,
}

describe('authService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('login', () => {
    it('desempacota data.data do envelope ApiResponse', async () => {
      vi.mocked(api.post).mockResolvedValueOnce({
        data: { data: mockLoginResponse, message: 'Login realizado com sucesso.' },
      })

      const result = await login('ana@exemplo.com', 'senha123')

      expect(result).toEqual(mockLoginResponse)
      expect(result.token).toBe(mockLoginResponse.token)
      expect(result.user.nome).toBe('Ana Silva')
    })

    it('chama o endpoint correto com email e password', async () => {
      vi.mocked(api.post).mockResolvedValueOnce({
        data: { data: mockLoginResponse },
      })

      await login('ana@exemplo.com', 'senha123')

      expect(api.post).toHaveBeenCalledWith('/api/v1/auth/login', {
        email: 'ana@exemplo.com',
        password: 'senha123',
      })
    })

    it('propaga erro de rede (não engole)', async () => {
      vi.mocked(api.post).mockRejectedValueOnce(new Error('Network Error'))

      await expect(login('x@x.com', 'errado')).rejects.toThrow('Network Error')
    })
  })

  describe('getMe', () => {
    it('desempacota data.data do envelope ApiResponse', async () => {
      vi.mocked(api.get).mockResolvedValueOnce({
        data: { data: mockUser },
      })

      const result = await getMe()

      expect(result).toEqual(mockUser)
      expect(result.id).toBe('user-id-123')
      expect(result.email).toBe('ana@exemplo.com')
    })

    it('chama o endpoint correto', async () => {
      vi.mocked(api.get).mockResolvedValueOnce({
        data: { data: mockUser },
      })

      await getMe()

      expect(api.get).toHaveBeenCalledWith('/api/v1/auth/me')
    })
  })

  describe('logout', () => {
    it('ignora erros (best-effort) e resolve normalmente', async () => {
      vi.mocked(api.post).mockRejectedValueOnce(new Error('Servidor indisponível'))

      // Não deve lançar erro — é best-effort
      await expect(logout()).resolves.toBeUndefined()
    })

    it('chama o endpoint de logout', async () => {
      vi.mocked(api.post).mockResolvedValueOnce({ status: 204 })

      await logout()

      expect(api.post).toHaveBeenCalledWith('/api/v1/auth/logout')
    })
  })
})
