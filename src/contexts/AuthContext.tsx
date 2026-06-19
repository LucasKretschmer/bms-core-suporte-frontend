import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import * as authService from '../features/auth/services/authService'
import { tokenStore } from '../utils/tokenStore'
import type { AuthUser } from '../features/auth/types/authSchema'

type AuthContextValue = {
  user: AuthUser | null
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

/**
 * Provider de autenticação.
 *
 * SEGURANÇA: token JWT vive APENAS em memória (tokenStore + estado React).
 * Nunca em localStorage/sessionStorage.
 *
 * Bootstrap: app inicia deslogado — sem rehydrate de sessão.
 * F5 perde o token → usuário vai para /login?redirect=<rota>.
 *
 * O interceptor do Axios emite 'auth:logout' em 401 → este provider escuta.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const logoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const navigate = useNavigate()

  const logout = useCallback(async () => {
    // Cancela timer de expiração
    if (logoutTimerRef.current) {
      clearTimeout(logoutTimerRef.current)
      logoutTimerRef.current = null
    }
    // Notifica o backend (best-effort)
    await authService.logout()
    // Limpa token e estado
    tokenStore.clear()
    setUser(null)
    // Redireciona para login
    navigate({ to: '/login' })
  }, [navigate])

  const login = useCallback(
    async (email: string, password: string) => {
      const response = await authService.login(email, password)
      // Guarda token em memória
      tokenStore.set(response.token, response.expiresAt)
      // Atualiza estado React
      setUser(response.user)
      // Agenda logout automático ao expirar o token
      const expiresAt = new Date(response.expiresAt).getTime()
      const msUntilExpiry = expiresAt - Date.now()
      if (msUntilExpiry > 0) {
        if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current)
        logoutTimerRef.current = setTimeout(() => {
          logout()
        }, msUntilExpiry)
      }
    },
    [logout],
  )

  // Listener do interceptor Axios (401 → logout automático)
  useEffect(() => {
    function handleAuthLogout() {
      // Limpa estado sem chamar authService (token já é inválido)
      if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current)
      tokenStore.clear()
      setUser(null)
      navigate({ to: '/login' })
    }

    window.addEventListener('auth:logout', handleAuthLogout)
    return () => window.removeEventListener('auth:logout', handleAuthLogout)
  }, [navigate])

  // Limpa timer ao desmontar
  useEffect(() => {
    return () => {
      if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current)
    }
  }, [])

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: user !== null, login, logout }}>
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
