/**
 * De-para entre o "perfil de produto" exibido no combobox e a role do backend.
 *
 * O combobox expõe apenas DOIS perfis de produto:
 *   - "atendente" ↔ role `Atendente` (1)
 *   - "gestor"    ↔ role `Gerente`   (3)
 *
 * Decisão de produto (demanda 012): "gestor" mapeia para `Gerente`.
 * Para EXIBIR: a role `ATENDENTE` vira "atendente"; qualquer outra
 * (COORDENADOR / GERENTE / ADMIN) vira "gestor".
 *
 * O backend é a fonte de verdade — este de-para concentra a tradução num único
 * ponto para que uma eventual mudança de produto seja trivial (R5 da arquitetura).
 */

/** Perfil de produto selecionável no combobox. */
export type AgentProfile = 'atendente' | 'gestor'

/** Valor numérico da role no backend (enum Role: INT2). */
export const ROLE_CODE = {
  Atendente: 1,
  Coordenador: 2,
  Gerente: 3,
  Admin: 4,
} as const

export type RoleCode = (typeof ROLE_CODE)[keyof typeof ROLE_CODE]

/** Nome textual da role como vem do backend (`AgentDto.papel`). */
export type RoleName = 'ATENDENTE' | 'COORDENADOR' | 'GERENTE' | 'ADMIN'

/**
 * Converte a role textual do backend no perfil de produto exibido.
 * `ATENDENTE` → "atendente"; qualquer outra (incl. desconhecida) → "gestor".
 */
export function roleNameToProfile(papel: string): AgentProfile {
  return papel.toUpperCase() === 'ATENDENTE' ? 'atendente' : 'gestor'
}

/**
 * Converte o perfil de produto no código numérico de role enviado ao backend.
 * "atendente" → 1 (Atendente); "gestor" → 3 (Gerente).
 */
export function profileToRoleCode(profile: AgentProfile): RoleCode {
  return profile === 'atendente' ? ROLE_CODE.Atendente : ROLE_CODE.Gerente
}

/** Opções do combobox de perfil (rótulos em português, capitalizados). */
export const AGENT_PROFILE_OPTIONS: { value: AgentProfile; label: string }[] = [
  { value: 'atendente', label: 'Atendente' },
  { value: 'gestor', label: 'Gestor' },
]
