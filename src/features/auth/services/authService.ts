import { api } from '../../../services/api'
import type { ApiResponse } from '../../../types/api'
import type { AuthUser, LoginResponse } from '../types/authSchema'

/**
 * Serviço de autenticação.
 * Desempacotamento do envelope no service — nunca espalhar pelos componentes.
 */

/** POST /api/v1/auth/login → ApiResponse<LoginResponseDto> */
export async function login(email: string, password: string): Promise<LoginResponse> {
  const { data } = await api.post<ApiResponse<LoginResponse>>('/api/v1/auth/login', { email, password })
  return data.data
}

/**
 * POST /api/v1/auth/refresh → ApiResponse<LoginResponseDto> (mesmo shape do login).
 *
 * Sem body: o cookie httpOnly de refresh (Path=/api/v1/auth) é enviado
 * automaticamente pelo browser (depende de withCredentials no Axios).
 * NÃO é best-effort: propaga o erro 401 para quem chama (ensureSession) decidir o fallback.
 */
export async function refresh(): Promise<LoginResponse> {
  const { data } = await api.post<ApiResponse<LoginResponse>>('/api/v1/auth/refresh')
  return data.data
}

/** GET /api/v1/auth/me → ApiResponse<UserResponseDto> */
export async function getMe(): Promise<AuthUser> {
  const { data } = await api.get<ApiResponse<AuthUser>>('/api/v1/auth/me')
  return data.data
}

/**
 * POST /api/v1/auth/logout → 204
 * Best-effort: ignora erros (JWT continua válido até expirar no backend).
 */
export async function logout(): Promise<void> {
  try {
    await api.post('/api/v1/auth/logout')
  } catch {
    // Best-effort — não propaga erro de logout
  }
}
