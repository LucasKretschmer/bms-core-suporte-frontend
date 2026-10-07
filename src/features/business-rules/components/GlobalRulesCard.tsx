import { useState } from 'react'
import { Badge } from '../../../components/ui/Badge'
import { InfoIcon } from '../../../components/ui/InfoIcon'
import { GLOBAL_INT_RULES, asIntRule, resolveRule } from '../types/businessRule'
import type { BusinessRuleDto, GlobalIntRuleMeta } from '../types/businessRule'

export type SaveGlobalRuleArgs = {
  ruleId: number | null
  chave: string
  valor: number
}

type GlobalRulesCardProps = {
  rules: BusinessRuleDto[]
  isSaving: boolean
  /**
   * Se o usuário pode escrever regra global (só GerentePlus; o backend é a fonte de verdade).
   * Sem permissão o valor continua visível, em modo somente leitura.
   */
  canEdit: boolean
  onSaveRule: (args: SaveGlobalRuleArgs) => void
}

const READONLY_NOTE_ID = 'global-rules-readonly-note'

/**
 * Card de regras globais inteiras. Salva no blur quando o valor muda e está na faixa;
 * fora da faixa, reverte. Somente leitura usa `readOnly` (não `disabled`) para o campo
 * seguir focável e o motivo, associado por `aria-describedby`, ser anunciado.
 */
export function GlobalRulesCard({ rules, isSaving, canEdit, onSaveRule }: GlobalRulesCardProps) {
  return (
    <section
      aria-labelledby="global-rules-heading"
      className="bg-card rounded-card border border-border p-6 flex flex-col gap-4"
    >
      <div className="flex items-center gap-2 flex-wrap">
        <h2 id="global-rules-heading" className="text-[16px] font-medium text-foreground">
          Regras globais
        </h2>
        {!canEdit && <Badge value="Somente leitura" />}
      </div>

      {!canEdit && (
        <p
          id={READONLY_NOTE_ID}
          className="flex items-start gap-2 rounded-input bg-info-bg text-info-fg text-xs px-3 py-2 max-w-2xl"
        >
          <svg
            aria-hidden="true"
            className="h-4 w-4 shrink-0 mt-px"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
          <span>
            Somente leitura: apenas os perfis Gerente e Administrador podem alterar as regras
            globais. As regras por equipe continuam editáveis.
          </span>
        </p>
      )}

      <div className="flex flex-wrap gap-6">
        {GLOBAL_INT_RULES.map((meta) => {
          const resolved = resolveRule(rules, meta.chave)
          const current = asIntRule(resolved.value, meta.chave)
          return (
            <GlobalIntRuleField
              // A key com o valor atual reidrata o campo quando a regra recarrega.
              key={`${meta.chave}-${current}`}
              meta={meta}
              ruleId={resolved.ruleId}
              current={current}
              isSaving={isSaving}
              canEdit={canEdit}
              onSaveRule={onSaveRule}
            />
          )
        })}
      </div>
    </section>
  )
}

type GlobalIntRuleFieldProps = {
  meta: GlobalIntRuleMeta
  ruleId: number | null
  current: number
  isSaving: boolean
  canEdit: boolean
  onSaveRule: (args: SaveGlobalRuleArgs) => void
}

function GlobalIntRuleField({
  meta,
  ruleId,
  current,
  isSaving,
  canEdit,
  onSaveRule,
}: GlobalIntRuleFieldProps) {
  const [value, setValue] = useState<string>(String(current))
  const inputId = `global-rule-${meta.chave}`
  const hintId = `${inputId}-hint`

  function commit() {
    if (!canEdit) {
      setValue(String(current))
      return
    }
    const parsed = Number(value)
    if (value.trim() === '' || !Number.isInteger(parsed) || parsed < meta.min || parsed > meta.max) {
      setValue(String(current))
      return
    }
    if (parsed !== current) {
      onSaveRule({ ruleId, chave: meta.chave, valor: parsed })
    }
  }

  return (
    <div className="flex flex-col space-y-0.5 w-60">
      <label
        htmlFor={inputId}
        className="flex items-center gap-1.5 text-xs lg:text-sm font-normal text-foreground"
      >
        {meta.label}
        <InfoIcon tooltip={meta.tooltip} />
      </label>
      <input
        id={inputId}
        type="number"
        min={meta.min}
        max={meta.max}
        value={value}
        disabled={isSaving}
        readOnly={!canEdit}
        aria-describedby={canEdit ? hintId : `${hintId} ${READONLY_NOTE_ID}`}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        className="h-9 rounded-input border border-border px-3 py-2.5 text-sm text-foreground bg-card outline-none focus:border-primary-medium focus:ring-0 disabled:opacity-50 read-only:bg-background read-only:text-foreground/70 read-only:cursor-not-allowed"
      />
      <p id={hintId} className="text-xs text-foreground/70">
        {meta.hint}
      </p>
    </div>
  )
}
