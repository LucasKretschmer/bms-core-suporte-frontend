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
  /**
   * NOVO (118.6). Não-atendente autenticado ("gestor" no modelo binário
   * atendente × gerente). Usar esta flag — não `isCoordenadorOuAcima` invertida —
   * para as decisões de RBAC de UI introduzidas na 118.6 (Sidebar, DashboardFilters).
   */
  isGestor: boolean
  /**
   * NOVO (118.6). Equipe primária do usuário — usada para travar o seletor de
   * equipe do atendente em DashboardFilters. `null` se o usuário não tiver equipe
   * primária (edge case fail-closed — ver DashboardFilters/support/index.tsx).
   */
  primaryTeamId: number | null
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
    isGestor: user !== null && role !== 'ATENDENTE',
    primaryTeamId: user?.primaryTeamId ?? null,
    isAuthenticated: user !== null,
  }
}
