import { useEffect, useState } from 'react'
import { InfoIcon } from '../../../components/ui/InfoIcon'
import { GLOBAL_IDLE_KEY, asMinutes, resolveRule, type BusinessRuleDto } from '../types/businessRule'

type GlobalRulesCardProps = {
  rules: BusinessRuleDto[]
  isSaving: boolean
  onSaveIdle: (args: { ruleId: string | null; minutes: number }) => void
}

/**
 * Card de regras globais. Hoje: alerta de inatividade (min, 1..60).
 * Salva no blur quando o valor muda e é válido.
 */
export function GlobalRulesCard({ rules, isSaving, onSaveIdle }: GlobalRulesCardProps) {
  const resolved = resolveRule(rules, GLOBAL_IDLE_KEY)
  const currentMinutes = asMinutes(resolved.value)

  const [value, setValue] = useState<string>(String(currentMinutes))

  // Reidrata quando a regra carregada muda (ex.: após refetch)
  useEffect(() => {
    setValue(String(currentMinutes))
  }, [currentMinutes])

  function commit() {
    const parsed = Number(value)
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 60) {
      // valor inválido → reverte para o atual
      setValue(String(currentMinutes))
      return
    }
    if (parsed !== currentMinutes) {
      onSaveIdle({ ruleId: resolved.ruleId, minutes: parsed })
    }
  }

  return (
    <section
      aria-labelledby="global-rules-heading"
      className="bg-card rounded-[5px] border border-border p-6 flex flex-col gap-4"
    >
      <h2 id="global-rules-heading" className="text-[16px] font-medium text-foreground">
        Regras globais
      </h2>

      <div className="flex flex-col space-y-0.5 w-60">
        <label
          htmlFor="idle-alert-minutes"
          className="flex items-center gap-1.5 text-xs lg:text-sm font-normal text-foreground"
        >
          Alerta de inatividade (min)
          <InfoIcon tooltip="Minutos sem atividade antes de alertar o atendente sobre o timer ocioso." />
        </label>
        <input
          id="idle-alert-minutes"
          type="number"
          min={1}
          max={60}
          value={value}
          disabled={isSaving}
          onChange={(e) => setValue(e.target.value)}
          onBlur={commit}
          className="h-9 rounded-[5px] border border-border px-3 py-2.5 text-sm text-foreground bg-card outline-none focus:border-[#666] focus:ring-0 disabled:opacity-50"
        />
        <p className="text-xs text-foreground/50">Entre 1 e 60 minutos.</p>
      </div>
    </section>
  )
}
