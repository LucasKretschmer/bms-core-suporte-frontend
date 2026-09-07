import { useId } from 'react'
import { ErrorState } from '../../../components/ui/ErrorState'
import { Skeleton } from '../../../components/ui/Skeleton'
import { Switch } from '../../../components/ui/Switch'
import {
  TEAM_BOOL_KEYS,
  TEAM_RULE_META,
  asBool,
  resolveRule,
  type BusinessRuleDto,
  type RuleValue,
  type TeamRuleKey,
} from '../types/businessRule'

type TeamRulesCardProps = {
  teamNome: string
  rules: BusinessRuleDto[]
  isLoading: boolean
  isError: boolean
  isSaving: boolean
  onSave: (args: { ruleId: number | null; chave: string; valor: RuleValue }) => void
}

/**
 * Card de regras de uma equipe: 6 toggles booleanos.
 * Cada alteração persiste imediatamente (upsert por chave).
 *
 * O combo "Ao enviar resposta" (regra `autoStopOnReply`) foi REMOVIDO em 2026-08-04
 * (demanda 121, decisão D11): a preferência foi aposentada — mudança de estágio do
 * chamado encerra o timer de todos os atendentes, sem escolha por equipe. O backend
 * deixou de aceitar a chave na escrita (`POST`/`PUT /api/v1/business-rules`).
 *
 * Regras persistidas que o card não conhece (inclusive linhas antigas de
 * `autoStopOnReply`, que continuam no banco) são simplesmente IGNORADAS: o card
 * enumera `TEAM_BOOL_KEYS` e resolve por chave, então chave desconhecida não é
 * renderizada, não é gravada e não é apagada.
 */
export function TeamRulesCard({
  teamNome,
  rules,
  isLoading,
  isError,
  isSaving,
  onSave,
}: TeamRulesCardProps) {
  const baseId = useId()

  return (
    <section
      aria-labelledby={`${baseId}-heading`}
      className="bg-card rounded-card border border-border p-5 flex flex-col gap-4 min-w-[280px] flex-1 max-w-md"
    >
      <h3 id={`${baseId}-heading`} className="text-[16px] font-medium text-foreground">
        {teamNome}
      </h3>

      {isLoading && <Skeleton lines={4} height="h-6" />}
      {!isLoading && isError && (
        <ErrorState message="Não foi possível carregar as regras desta equipe." />
      )}

      {!isLoading && !isError && (
        <ul className="flex flex-col gap-3">
          {TEAM_BOOL_KEYS.map((key: TeamRuleKey) => {
            const resolved = resolveRule(rules, key)
            const checked = asBool(resolved.value)
            const meta = TEAM_RULE_META[key]
            const switchId = `${baseId}-${key}`
            return (
              <li key={key} className="flex items-start justify-between gap-3">
                <label htmlFor={switchId} className="flex flex-col cursor-pointer">
                  <span className="text-sm text-foreground">{meta.label}</span>
                  <span className="text-xs text-foreground/70">{meta.description}</span>
                </label>
                <Switch
                  id={switchId}
                  checked={checked}
                  disabled={isSaving}
                  hideLabel={false}
                  label={meta.label}
                  onChange={(next) => onSave({ ruleId: resolved.ruleId, chave: key, valor: next })}
                />
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
