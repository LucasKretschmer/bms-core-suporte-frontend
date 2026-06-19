/**
 * Tipos das regras de negócio (Configurações).
 * Backend: BusinessRuleDto { id, teamId, chave, valor: <JSON>, criadoEm, atualizadoEm }
 * Envelope GET/POST/PUT: ApiResponse<...>. Valor é um JSON arbitrário (bool | string | number).
 *
 * Chaves e domínios confirmados no backend (BusinessRuleKeys):
 * - bool:   singleActiveTimer, allowEditTimes, allowCrossTeam,
 *           notifyStatusChange, notifyNewInQueue, showProjectActivities
 * - string: autoStopOnReply ∈ { 'prompt' | 'auto' | 'off' }
 * - int:    idleAlertMinutes (1..60)
 */

/** Valor cru de uma regra — o backend serializa JSON arbitrário. */
export type RuleValue = boolean | string | number

/** DTO de regra retornado pelo backend (valor já desserializado para JS). */
export type BusinessRuleDto = {
  id: string
  teamId: string | null
  chave: string
  valor: RuleValue
  criadoEm: string
  atualizadoEm: string
}

export type TeamRuleKey =
  | 'singleActiveTimer'
  | 'allowCrossTeam'
  | 'showProjectActivities'
  | 'allowEditTimes'
  | 'notifyStatusChange'
  | 'notifyNewInQueue'

export const TEAM_BOOL_KEYS: TeamRuleKey[] = [
  'singleActiveTimer',
  'allowCrossTeam',
  'showProjectActivities',
  'allowEditTimes',
  'notifyStatusChange',
  'notifyNewInQueue',
]

export type AutoStopOnReply = 'prompt' | 'auto' | 'off'

export const GLOBAL_IDLE_KEY = 'idleAlertMinutes'
export const AUTO_STOP_KEY = 'autoStopOnReply'

/** Valores padrão (espelham os Defaults do backend). */
export const RULE_DEFAULTS: Record<string, RuleValue> = {
  singleActiveTimer: true,
  allowEditTimes: false,
  allowCrossTeam: false,
  autoStopOnReply: 'prompt',
  notifyStatusChange: true,
  notifyNewInQueue: true,
  showProjectActivities: false,
  idleAlertMinutes: 5,
}

/** Metadados de exibição dos toggles por equipe (rótulo + descrição). */
export const TEAM_RULE_META: Record<TeamRuleKey, { label: string; description: string }> = {
  singleActiveTimer: {
    label: 'Timer único',
    description: 'Permite apenas um timer ativo por atendente.',
  },
  allowCrossTeam: {
    label: 'Associar chamados de outras equipes',
    description: 'Atendentes podem apontar em chamados de outras equipes.',
  },
  showProjectActivities: {
    label: 'Mostrar atividades de projetos',
    description: 'Exibe atividades de projetos no timer.',
  },
  allowEditTimes: {
    label: 'Permitir editar horários',
    description: 'Permite editar horários de apontamentos já lançados.',
  },
  notifyStatusChange: {
    label: 'Notificar mudança de status',
    description: 'Notifica a equipe quando o status de um chamado muda.',
  },
  notifyNewInQueue: {
    label: 'Notificar novo chamado na fila',
    description: 'Notifica a equipe quando um novo chamado entra na fila.',
  },
}

export const AUTO_STOP_OPTIONS: { value: AutoStopOnReply; label: string }[] = [
  { value: 'prompt', label: 'Perguntar' },
  { value: 'auto', label: 'Encerrar automático' },
  { value: 'off', label: 'Desativado' },
]

/** Estado resolvido de uma regra: valor efetivo + id do registro (null = ainda não persistido). */
export type ResolvedRule = {
  value: RuleValue
  ruleId: string | null
}

/**
 * Resolve uma chave a partir da lista de regras, aplicando o default quando ausente.
 * Util puro — testável.
 */
export function resolveRule(
  rules: BusinessRuleDto[],
  chave: string,
): ResolvedRule {
  const found = rules.find((r) => r.chave === chave)
  if (found) return { value: found.valor, ruleId: found.id }
  return { value: RULE_DEFAULTS[chave], ruleId: null }
}

export function asBool(value: RuleValue): boolean {
  return value === true
}

export function asAutoStop(value: RuleValue): AutoStopOnReply {
  return value === 'auto' || value === 'off' ? value : 'prompt'
}

export function asMinutes(value: RuleValue): number {
  return typeof value === 'number' ? value : RULE_DEFAULTS.idleAlertMinutes as number
}
