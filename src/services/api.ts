import axios from 'axios'
import { tokenStore } from '../utils/tokenStore'
import { ensureSession } from '../utils/ensureSession'

/**
 * Estende a config interna do Axios com o flag `_retry` (sem `any`).
 * Marca uma request que já foi retentada após refresh — evita loop.
 */
declare module 'axios' {
  export interface InternalAxiosRequestConfig {
    _retry?: boolean
  }
}

/**
 * Instância Axios centralizada.
 * NUNCA usar axios diretamente — sempre esta instância.
 *
 * Segurança:
 * - baseURL via VITE_API_URL (env pública, nunca secret)
 * - Bearer token (access) lido de memória (tokenStore), nunca de localStorage
 * - withCredentials: true → cookie httpOnly de refresh (Path=/api/v1/auth)
 *   viaja automaticamente nos endpoints de auth. Como o cookie só existe nesse
 *   path, não vaza para os demais endpoints mesmo com withCredentials global.
 * - 401 em request de negócio → tenta refresh UMA vez e refaz a request;
 *   refresh falho → emite 'auth:logout' (AuthContext escuta).
 */
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Interceptor de request: injeta Bearer token (access) de memória
api.interceptors.request.use((config) => {
  const token = tokenStore.get()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Endpoints de auth — nunca tentar refresh para eles (anti-loop)
const AUTH_PATHS = ['/api/v1/auth/login', '/api/v1/auth/refresh', '/api/v1/auth/logout']

function emitLogout(): void {
  tokenStore.clear()
  window.dispatchEvent(new CustomEvent('auth:logout', { detail: { reason: '401' } }))
}

// Interceptor de response: 401 → refresh-once → retry da request original
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (!axios.isAxiosError(error) || error.response?.status !== 401) {
      return Promise.reject(error)
    }

    const original = error.config
    const url = original?.url ?? ''

    // Não retentar: sem config, já retentado, ou é um endpoint de auth (loop)
    if (!original || original._retry || AUTH_PATHS.some((p) => url.includes(p))) {
      emitLogout()
      return Promise.reject(error)
    }

    original._retry = true

    // Reusa o lock único do ensureSession — um só refresh para N requests 401
    await ensureSession()

    if (tokenStore.isValid()) {
      original.headers.Authorization = `Bearer ${tokenStore.get()}`
      return api.request(original)
    }

    emitLogout()
    return Promise.reject(error)
  },
)
