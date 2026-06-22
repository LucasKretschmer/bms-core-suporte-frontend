import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import * as authService from '../features/auth/services/authService'
import { tokenStore } from '../utils/tokenStore'
import { ensureSession, resetSession } from '../utils/ensureSession'
import { router } from '../router'
import { queryClient } from '../queryClient'
import type { AuthUser } from '../features/auth/types/authSchema'

type AuthContextValue = {
  user: AuthUser | null
  isAuthenticated: boolean
  isBootstrapping: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

/**
 * Provider de autenticação.
 *
 * SEGURANÇA: o access token vive APENAS em memória (tokenStore + estado React).
 * Nunca em localStorage/sessionStorage. O refresh vive só em cookie httpOnly.
 *
 * Bootstrap: ao montar, tenta reidratar a sessão via `ensureSession()`
 * (POST /auth/refresh com cookie) — sobrevive ao F5 sem novo login.
 *
 * Expiração do access: tratada reativamente pelo interceptor 401 do Axios
 * (refresh-once → retry). Não há auto-logout por timer.
 *
 * Navegação: usa a instância singleton `router` (não useNavigate) porque o
 * provider é montado FORA do RouterProvider — useNavigate aqui seria no-op.
 *
 * O interceptor do Axios emite 'auth:logout' quando o refresh esgota → este
 * provider escuta e limpa a sessão.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isBootstrapping, setIsBootstrapping] = useState(true)

  // Rehydrate no mount — reusa o lock único do ensureSession
  useEffect(() => {
    let active = true
    ensureSession()
      .then((reidratado) => {
        if (active && reidratado) setUser(reidratado)
      })
      .finally(() => {
        if (active) setIsBootstrapping(false)
      })
    return () => {
      active = false
    }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const response = await authService.login(email, password)
    tokenStore.set(response.token, response.expiresAt)
    setUser(response.user)
  }, [])

  const logout = useCallback(async () => {
    await authService.logout() // best-effort: backend revoga sessão + limpa cookie
    tokenStore.clear()
    resetSession()
    setUser(null)
    queryClient.clear() // limpa cache do usuário anterior
    router.navigate({ to: '/login' })
  }, [])

  // Listener do interceptor Axios (401 → refresh esgotado → logout)
  useEffect(() => {
    function handleAuthLogout() {
      // Fallback: token já é inválido, não chama authService.logout
      tokenStore.clear()
      resetSession()
      setUser(null)
      queryClient.clear()
      router.navigate({ to: '/login' })
    }

    window.addEventListener('auth:logout', handleAuthLogout)
    return () => window.removeEventListener('auth:logout', handleAuthLogout)
  }, [])

  return (
    <AuthContext.Provider
      value={{ user, isAuthenticated: user !== null, isBootstrapping, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  )
}

/** Hook interno — use useAuth() que fica em hooks/useAuth.ts */
export function useAuthContext(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuthContext deve ser usado dentro de <AuthProvider>')
  return ctx
}
