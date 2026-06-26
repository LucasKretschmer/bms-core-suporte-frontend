import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

// Mock do useAuth para controlar o user retornado
vi.mock('./useAuth', () => ({
  useAuth: vi.fn(),
}))

import { useAuth } from './useAuth'
import { usePermissions } from './usePermissions'
import type { AuthUser } from '../features/auth/types/authSchema'

function makeUser(role: AuthUser['role']): AuthUser {
  return {
    id: '1',
    nome: 'Test User',
    email: 'test@test.com',
    role,
    hubspotOwnerId: 1,
    primaryTeamId: null,
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
})
