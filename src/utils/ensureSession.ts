import { refresh } from '../features/auth/services/authService'
import { tokenStore } from './tokenStore'
import type { AuthUser } from '../features/auth/types/authSchema'

/**
 * Rehydrate de sessão com lock único (promessa memoizada em voo).
 *
 * Único ponto de verdade para reidratar o access token via cookie httpOnly
 * (POST /auth/refresh). Compartilhado entre:
 * - AuthProvider (no mount, para popular o `user`),
 * - guard `_auth.beforeLoad` (gating de rota),
 * - interceptor 401 do Axios (refaz request após refresh).
 *
 * A memoização (`inflight`) garante que múltiplas chamadas concorrentes
 * disparem APENAS UM POST /auth/refresh (mitiga corrida de refresh / múltiplas
 * requests simultâneas).
 *
 * `lastUser` cacheia o último user reidratado para que o provider obtenha o
 * user mesmo quando o tokenStore já está válido (refresh resolveu antes do mount),
 * evitando um 2º round-trip (/auth/me).
 */

let inflight: Promise<AuthUser | null> | null = null
let lastUser: AuthUser | null = null

export function ensureSession(): Promise<AuthUser | null> {
  // Sessão em memória já válida — devolve o último user reidratado (ou null).
  if (tokenStore.isValid()) return Promise.resolve(lastUser)
  // Já há um refresh em voo — reusa a mesma promessa (lock).
  if (inflight) return inflight

  inflight = refresh()
    .then((res) => {
      tokenStore.set(res.token, res.expiresAt)
      lastUser = res.user
      return res.user
    })
    .catch(() => {
      tokenStore.clear()
      lastUser = null
      return null
    })
    .finally(() => {
      inflight = null
    })

  return inflight
}

/**
 * Zera o estado do ensureSession. Chamado no logout para que uma sessão
 * antiga não vaze (inflight pendente ou lastUser cacheado).
 */
export function resetSession(): void {
  inflight = null
  lastUser = null
}
