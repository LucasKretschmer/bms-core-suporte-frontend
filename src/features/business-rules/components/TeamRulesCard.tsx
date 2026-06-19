import { useId } from 'react'
import { Combobox } from '../../../components/ui/Combobox'
import { ErrorState } from '../../../components/ui/ErrorState'
import { Skeleton } from '../../../components/ui/Skeleton'
import { Switch } from '../../../components/ui/Switch'
import {
  AUTO_STOP_KEY,
  AUTO_STOP_OPTIONS,
  TEAM_BOOL_KEYS,
  TEAM_RULE_META,
  asAutoStop,
  asBool,
  resolveRule,
  type AutoStopOnReply,
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
  onSave: (args: { ruleId: string | null; chave: string; valor: RuleValue }) => void
}

/**
 * Card de regras de uma equipe: 6 toggles + combo "Ao enviar resposta".
 * Cada alteração persiste imediatamente (upsert por chave).
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
  const autoStop = resolveRule(rules, AUTO_STOP_KEY)

  return (
    <section
      aria-labelledby={`${baseId}-heading`}
      className="bg-card rounded-xl border border-border p-5 flex flex-col gap-4 min-w-[280px] flex-1 max-w-md"
    >
      <h3 id={`${baseId}-heading`} className="text-[16px] font-medium text-foreground">
        {teamNome}
      </h3>

      {isLoading && <Skeleton lines={4} height="h-6" />}
      {!isLoading && isError && (
        <ErrorState message="Não foi possível carregar as regras desta equipe." />
      )}

      {!isLoading && !isError && (
        <>
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
                    <span className="text-xs text-foreground/60">{meta.description}</span>
                  </label>
                  <Switch
                    id={switchId}
                    checked={checked}
                    disabled={isSaving}
                    hideLabel={false}
                    label={meta.label}
                    onChange={(next) =>
                      onSave({ ruleId: resolved.ruleId, chave: key, valor: next })
                    }
                  />
                </li>
              )
            })}
          </ul>

          <div className="pt-1">
            <Combobox
              id={`${baseId}-autostop`}
              label="Ao enviar resposta"
              value={asAutoStop(autoStop.value)}
              options={AUTO_STOP_OPTIONS}
              onChange={(value) =>
                onSave({
                  ruleId: autoStop.ruleId,
                  chave: AUTO_STOP_KEY,
                  valor: value as AutoStopOnReply,
                })
              }
              disabled={isSaving}
            />
          </div>
        </>
      )}
    </section>
  )
}
