import { z } from 'zod'

/** Schema do formulário de login — fonte da verdade, nunca duplicar validações. */
export const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'O e-mail é obrigatório.')
    .email('Informe um e-mail válido.'),
  password: z
    .string()
    .min(1, 'A senha é obrigatória.')
    .max(128, 'A senha deve ter no máximo 128 caracteres.'),
})

export type LoginFormData = z.infer<typeof loginSchema>

/** Roles do sistema — conjunto fixo mapeado do backend. */
export type UserRole = 'ATENDENTE' | 'COORDENADOR' | 'GERENTE' | 'ADMIN'

/** Usuário autenticado (mapeado de UserResponseDto do backend). */
export type AuthUser = {
  id: string
  nome: string
  email: string
  role: UserRole
  hubspotOwnerId: number
  primaryTeamId: string | null
}

/** Response do login (mapeado de LoginResponseDto do backend). */
export type LoginResponse = {
  token: string
  expiresAt: string
  user: AuthUser
}
