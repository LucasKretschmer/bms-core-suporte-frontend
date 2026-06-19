import axios from 'axios'
import { tokenStore } from '../utils/tokenStore'

/**
 * Instância Axios centralizada.
 * NUNCA usar axios diretamente — sempre esta instância.
 *
 * Segurança:
 * - baseURL via VITE_API_URL (env pública, nunca secret)
 * - Bearer token lido de memória (tokenStore), nunca de localStorage
 * - 401 dispara evento customizado que o AuthContext escuta para logout
 * - Erros propagados via handleApiError (utils/)
 */
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Interceptor de request: injeta Bearer token de memória
api.interceptors.request.use((config) => {
  const token = tokenStore.get()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Interceptor de response: trata 401 → logout automático
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      // Limpa token da memória
      tokenStore.clear()
      // Dispara evento customizado que o AuthContext escuta
      window.dispatchEvent(new CustomEvent('auth:logout', { detail: { reason: '401' } }))
    }
    return Promise.reject(error)
  },
)
