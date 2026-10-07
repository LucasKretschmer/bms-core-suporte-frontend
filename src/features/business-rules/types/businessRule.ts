/**
 * Tipos das regras de negócio (Configurações).
 * Backend: BusinessRuleDto { id, teamId, chave, valor: <JSON>, criadoEm, atualizadoEm }
 * Envelope GET/POST/PUT: ApiResponse<...>. Valor é um JSON arbitrário (bool | string | number).
 *
 * Chaves e domínios confirmados no backend (BusinessRuleKeys):
 * - bool:   singleActiveTimer, allowEditTimes, allowCrossTeam,
 *           notifyStatusChange, notifyNewInQueue, showProjectActivities
 * - int:    idleAlertMinutes (1..60), jornadaHorasDia (1..24),
 *           toleranciaJornadaPercentual (0..200), limiteApontamentoHoras (1..24)
 *
 * `autoStopOnReply` (era string ∈ { 'prompt' | 'auto' | 'off' }) foi REVOGADA em
 * 2026-08-04 (demanda 121, decisão D11) e saiu daqui junto com o combo
 * "Ao enviar resposta": mudança de estágio do chamado passou a encerrar o timer de
 * todos os atendentes. O backend rejeita a chave na escrita; linhas já gravadas
 * continuam no banco (nenhum dado foi apagado) e são ignoradas por este módulo.
 */

/** Valor cru de uma regra — o backend serializa JSON arbitrário. */
export type RuleValue = boolean | string | number

/** DTO de regra retornado pelo backend (valor já desserializado para JS). */
export type BusinessRuleDto = {
  id: number
  teamId?: number | null
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

export const GLOBAL_IDLE_KEY = 'idleAlertMinutes'

/**
 * Valores padrão das chaves que o painel edita (espelham os Defaults do backend).
 * `autoStopOnReply` saiu deste mapa em 2026-08-04 (121/D11) — a chave não é mais
 * exibida nem gravada pelo painel.
 */
export const RULE_DEFAULTS: Record<string, RuleValue> = {
  singleActiveTimer: true,
  allowEditTimes: false,
  allowCrossTeam: false,
  notifyStatusChange: true,
  notifyNewInQueue: true,
  showProjectActivities: false,
  idleAlertMinutes: 5,
  jornadaHorasDia: 8,
  toleranciaJornadaPercentual: 20,
  limiteApontamentoHoras: 4,
}

/** Regra global numérica editável no card de regras globais. */
export type GlobalIntRuleMeta = {
  chave: string
  label: string
  tooltip: string
  hint: string
  min: number
  max: number
}

/** Regras globais inteiras, na ordem de exibição. Faixas espelham o backend. */
export const GLOBAL_INT_RULES: GlobalIntRuleMeta[] = [
  {
    chave: GLOBAL_IDLE_KEY,
    label: 'Alerta de inatividade (min)',
    tooltip: 'Minutos sem atividade antes de alertar o atendente sobre o timer ocioso.',
    hint: 'Entre 1 e 60 minutos.',
    min: 1,
    max: 60,
  },
  {
    chave: 'jornadaHorasDia',
    label: 'Jornada diária (h)',
    tooltip: 'Horas esperadas por dia útil. Base das horas úteis da Produtividade por Analista.',
    hint: 'Entre 1 e 24 horas.',
    min: 1,
    max: 24,
  },
  {
    chave: 'toleranciaJornadaPercentual',
    label: 'Tolerância da jornada (%)',
    tooltip: 'Margem sobre as horas úteis antes de destacar o analista como acima da jornada.',
    hint: 'Entre 0 e 200%.',
    min: 0,
    max: 200,
  },
  {
    chave: 'limiteApontamentoHoras',
    label: 'Limite por apontamento (h)',
    tooltip: 'Apontamentos acima deste total são destacados no detalhe do analista.',
    hint: 'Entre 1 e 24 horas.',
    min: 1,
    max: 24,
  },
]

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

/** Estado resolvido de uma regra: valor efetivo + id do registro (null = ainda não persistido). */
export type ResolvedRule = {
  value: RuleValue
  ruleId: number | null
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

export function asMinutes(value: RuleValue): number {
  return asIntRule(value, GLOBAL_IDLE_KEY)
}

/** Valor numérico da regra; fora disso, o default da chave. */
export function asIntRule(value: RuleValue, chave: string): number {
  if (typeof value === 'number') return value
  const fallback = RULE_DEFAULTS[chave]
  return typeof fallback === 'number' ? fallback : 0
}
