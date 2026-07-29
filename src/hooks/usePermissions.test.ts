import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

// Mock do useAuth para controlar o user retornado
vi.mock('./useAuth', () => ({
  useAuth: vi.fn(),
}))

import { useAuth } from './useAuth'
import { usePermissions } from './usePermissions'
import type { AuthUser } from '../features/auth/types/authSchema'

function makeUser(role: AuthUser['role'], primaryTeamId: number | null = null): AuthUser {
  return {
    id: 1,
    nome: 'Test User',
    email: 'test@test.com',
    role,
    hubspotOwnerId: 1,
    primaryTeamId,
  }
}

describe('usePermissions', () => {
  it('isCoordenadorOuAcima é true para COORDENADOR', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: makeUser('COORDENADOR'),
      isAuthenticated: true,
      login: vi.fn(),
      logout: vi.fn(),
    })
    const { result } = renderHook(() => usePermissions())
    expect(result.current.isCoordenadorOuAcima).toBe(true)
  })

  it('isCoordenadorOuAcima é true para GERENTE', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: makeUser('GERENTE'),
      isAuthenticated: true,
      login: vi.fn(),
      logout: vi.fn(),
    })
    const { result } = renderHook(() => usePermissions())
    expect(result.current.isCoordenadorOuAcima).toBe(true)
  })

  it('isCoordenadorOuAcima é true para ADMIN', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: makeUser('ADMIN'),
      isAuthenticated: true,
      login: vi.fn(),
      logout: vi.fn(),
    })
    const { result } = renderHook(() => usePermissions())
    expect(result.current.isCoordenadorOuAcima).toBe(true)
  })

  it('isCoordenadorOuAcima é false para ATENDENTE', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: makeUser('ATENDENTE'),
      isAuthenticated: true,
      login: vi.fn(),
      logout: vi.fn(),
    })
    const { result } = renderHook(() => usePermissions())
    expect(result.current.isCoordenadorOuAcima).toBe(false)
  })

  it('isCoordenadorOuAcima é false quando user é null', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      isAuthenticated: false,
      login: vi.fn(),
      logout: vi.fn(),
    })
    const { result } = renderHook(() => usePermissions())
    expect(result.current.isCoordenadorOuAcima).toBe(false)
    expect(result.current.role).toBeNull()
    expect(result.current.isAuthenticated).toBe(false)
  })

  it('isAtendente é true apenas para ATENDENTE', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: makeUser('ATENDENTE'),
      isAuthenticated: true,
      login: vi.fn(),
      logout: vi.fn(),
    })
    const { result } = renderHook(() => usePermissions())
    expect(result.current.isAtendente).toBe(true)
  })

  it('isAtendente é false para COORDENADOR', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: makeUser('COORDENADOR'),
      isAuthenticated: true,
      login: vi.fn(),
      logout: vi.fn(),
    })
    const { result } = renderHook(() => usePermissions())
    expect(result.current.isAtendente).toBe(false)
  })

  // ── isGerentePlus ──────────────────────────────────────────────────────────

  it('isGerentePlus é true para GERENTE', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: makeUser('GERENTE'),
      isAuthenticated: true,
      login: vi.fn(),
      logout: vi.fn(),
    })
    const { result } = renderHook(() => usePermissions())
    expect(result.current.isGerentePlus).toBe(true)
  })

  it('isGerentePlus é true para ADMIN', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: makeUser('ADMIN'),
      isAuthenticated: true,
      login: vi.fn(),
      logout: vi.fn(),
    })
    const { result } = renderHook(() => usePermissions())
    expect(result.current.isGerentePlus).toBe(true)
  })

  it('isGerentePlus é false para COORDENADOR', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: makeUser('COORDENADOR'),
      isAuthenticated: true,
      login: vi.fn(),
      logout: vi.fn(),
    })
    const { result } = renderHook(() => usePermissions())
    expect(result.current.isGerentePlus).toBe(false)
  })

  it('isGerentePlus é false para ATENDENTE', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: makeUser('ATENDENTE'),
      isAuthenticated: true,
      login: vi.fn(),
      logout: vi.fn(),
    })
    const { result } = renderHook(() => usePermissions())
    expect(result.current.isGerentePlus).toBe(false)
  })

  it('isGerentePlus é false quando user é null', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      isAuthenticated: false,
      login: vi.fn(),
      logout: vi.fn(),
    })
    const { result } = renderHook(() => usePermissions())
    expect(result.current.isGerentePlus).toBe(false)
  })

  // ── isGestor (118.6 — modelo binário atendente × gerente) ──────────────────

  it('isGestor é true para GERENTE', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: makeUser('GERENTE'),
      isAuthenticated: true,
      login: vi.fn(),
      logout: vi.fn(),
    })
    const { result } = renderHook(() => usePermissions())
    expect(result.current.isGestor).toBe(true)
  })

  it('isGestor é true para COORDENADOR', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: makeUser('COORDENADOR'),
      isAuthenticated: true,
      login: vi.fn(),
      logout: vi.fn(),
    })
    const { result } = renderHook(() => usePermissions())
    expect(result.current.isGestor).toBe(true)
  })

  it('isGestor é true para ADMIN', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: makeUser('ADMIN'),
      isAuthenticated: true,
      login: vi.fn(),
      logout: vi.fn(),
    })
    const { result } = renderHook(() => usePermissions())
    expect(result.current.isGestor).toBe(true)
  })

  it('isGestor é false para ATENDENTE', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: makeUser('ATENDENTE'),
      isAuthenticated: true,
      login: vi.fn(),
      logout: vi.fn(),
    })
    const { result } = renderHook(() => usePermissions())
    expect(result.current.isGestor).toBe(false)
  })

  it('isGestor é false quando user é null', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      isAuthenticated: false,
      login: vi.fn(),
      logout: vi.fn(),
    })
    const { result } = renderHook(() => usePermissions())
    expect(result.current.isGestor).toBe(false)
  })

  // ── primaryTeamId (118.6) ────────────────────────────────────────────────

  it('primaryTeamId reflete user.primaryTeamId quando autenticado', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: makeUser('ATENDENTE', 7),
      isAuthenticated: true,
      login: vi.fn(),
      logout: vi.fn(),
    })
    const { result } = renderHook(() => usePermissions())
    expect(result.current.primaryTeamId).toBe(7)
  })

  it('primaryTeamId é null quando o usuário autenticado não tem equipe primária', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: makeUser('ATENDENTE', null),
      isAuthenticated: true,
      login: vi.fn(),
      logout: vi.fn(),
    })
    const { result } = renderHook(() => usePermissions())
    expect(result.current.primaryTeamId).toBeNull()
  })

  it('primaryTeamId é null quando user é null', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      isAuthenticated: false,
      login: vi.fn(),
      logout: vi.fn(),
    })
    const { result } = renderHook(() => usePermissions())
    expect(result.current.primaryTeamId).toBeNull()
  })
})
