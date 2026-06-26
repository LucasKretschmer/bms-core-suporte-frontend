import { useAuthContext } from '../contexts/AuthContext'

/**
 * Hook público de autenticação.
 * Expõe: user, isAuthenticated, login, logout.
 */
export function useAuth() {
  return useAuthContext()
}
