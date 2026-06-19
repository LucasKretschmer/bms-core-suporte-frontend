import { useAuth } from './useAuth'
import type { UserRole } from '../features/auth/types/authSchema'

type PermissionsResult = {
  role: UserRole | null
  /** Coordenador, Gerente ou Admin — acesso a relatórios restritos */
  isCoordenadorOuAcima: boolean
  /** Gerente ou Admin — acesso ao Sincronizador e funcionalidades administrativas */
  isGerentePlus: boolean
  /** Apenas Atendente */
  isAtendente: boolean
  isAuthenticated: boolean
}

/**
 * Hook de permissões — derivado das roles do usuário autenticado.
 *
 * USO: esconder botões, itens de menu e barrar rotas no frontend (UX apenas).
 * O BACKEND é a fonte de verdade — sempre valida permissões no servidor.
 * Em caso de acesso não autorizado (403) → exibir ErrorState/redirect.
 */
export function usePermissions(): PermissionsResult {
  const { user } = useAuth()
  const role = user?.role ?? null

  return {
    role,
    isCoordenadorOuAcima: role === 'COORDENADOR' || role === 'GERENTE' || role === 'ADMIN',
    isGerentePlus: role === 'GERENTE' || role === 'ADMIN',
    isAtendente: role === 'ATENDENTE',
    isAuthenticated: user !== null,
  }
}
