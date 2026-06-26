import { Combobox } from '../../../components/ui/Combobox'
import { useUpdateAgentRole } from '../hooks/useUpdateAgentRole'
import {
  AGENT_PROFILE_OPTIONS,
  roleNameToProfile,
  type AgentProfile,
} from '../types/agentRole'
import type { AgentDto } from '../types/team'

type AgentRoleCellProps = {
  agent: AgentDto
  /** Se o usuário logado pode alterar papéis (UX — backend valida de fato). */
  canEdit: boolean
  /** True quando esta linha é o próprio usuário logado (aviso de re-login). */
  isSelf: boolean
}

/**
 * Célula da coluna "Perfil" (demanda 012 — #13).
 *
 * Exibe um combobox (size="sm") com os perfis de produto (atendente/gestor).
 * Ao trocar, dispara a mutation de atualização de papel. Cada célula tem sua
 * própria instância de mutation → `isPending` é isolado por linha.
 *
 * - Sem permissão: combobox desabilitado (UX; o backend é a fonte de verdade).
 * - Durante o submit: combobox desabilitado para evitar duplo envio.
 * - Próprio usuário: aviso de que a mudança só vale após novo login (R7).
 */
export function AgentRoleCell({ agent, canEdit, isSelf }: AgentRoleCellProps) {
  const mutation = useUpdateAgentRole()
  const currentProfile = roleNameToProfile(agent.papel)

  function handleChange(value: string) {
    const profile = value as AgentProfile
    if (profile === currentProfile) return
    mutation.mutate({ userId: agent.userId, profile })
  }

  return (
    <div className="flex flex-col items-stretch gap-0.5 min-w-[140px]">
      <Combobox
        id={`agent-role-${agent.userId}`}
        size="sm"
        value={currentProfile}
        options={AGENT_PROFILE_OPTIONS}
        onChange={handleChange}
        disabled={!canEdit || mutation.isPending}
      />
      {canEdit && isSelf && (
        <span className="text-xs text-foreground/50">
          Alterar o próprio perfil só vale após novo login.
        </span>
      )}
    </div>
  )
}
