import { useEffect, useState } from 'react'
import { Badge } from '../../../components/ui/Badge'
import { InfoIcon } from '../../../components/ui/InfoIcon'
import { GLOBAL_IDLE_KEY, asMinutes, resolveRule, type BusinessRuleDto } from '../types/businessRule'

type GlobalRulesCardProps = {
  rules: BusinessRuleDto[]
  isSaving: boolean
  /**
   * Se o usuário logado pode ESCREVER a regra global (`teamId: null`).
   * 122/REG-1-FE (decisão D16): só `GerentePlus` grava escopo global; o backend é a
   * fonte de verdade e recusa o POST/PUT dos demais papéis. Aqui é UX: o coordenador
   * continua VENDO o valor (D19 manteve a leitura aberta) mas não consegue alterá-lo.
   */
  canEdit: boolean
  onSaveIdle: (args: { ruleId: number | null; minutes: number }) => void
}

const HINT_ID = 'idle-alert-hint'
const READONLY_NOTE_ID = 'global-rules-readonly-note'

/**
 * Card de regras globais. Hoje: alerta de inatividade (min, 1..60).
 * Salva no blur quando o valor muda e é válido.
 *
 * Modo somente-leitura (`canEdit === false`, demanda 122 / decisão D16):
 * - o valor continua visível — esconder o card seria outra decisão, que não foi tomada;
 * - o input recebe `readOnly` (não `disabled`) de propósito: `disabled` tira o campo da
 *   ordem de tabulação e o motivo associado por `aria-describedby` nunca é anunciado a
 *   quem navega por teclado/leitor de tela. `readOnly` é a semântica HTML exata de
 *   "visível, não editável" e mantém o campo focável;
 * - o motivo é texto na tela (não só `title`), associado ao campo por `aria-describedby`;
 * - o estado é sinalizado também por texto (badge "Somente leitura"), não só por cor;
 * - `commit()` é travado — é a guarda real: `readOnly` não impede uma mudança de valor
 *   vinda de fora do teclado.
 */
export function GlobalRulesCard({ rules, isSaving, canEdit, onSaveIdle }: GlobalRulesCardProps) {
  const resolved = resolveRule(rules, GLOBAL_IDLE_KEY)
  const currentMinutes = asMinutes(resolved.value)

  const [value, setValue] = useState<string>(String(currentMinutes))

  // Reidrata quando a regra carregada muda (ex.: após refetch)
  useEffect(() => {
    setValue(String(currentMinutes))
  }, [currentMinutes])

  function commit() {
    if (!canEdit) {
      // Sem permissão de escrita: nunca dispara mutation e reverte qualquer valor digitado.
      setValue(String(currentMinutes))
      return
    }
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
          readOnly={!canEdit}
          aria-describedby={canEdit ? HINT_ID : `${HINT_ID} ${READONLY_NOTE_ID}`}
          onChange={(e) => setValue(e.target.value)}
          onBlur={commit}
          className="h-9 rounded-input border border-border px-3 py-2.5 text-sm text-foreground bg-card outline-none focus:border-primary-medium focus:ring-0 disabled:opacity-50 read-only:bg-background read-only:text-foreground/70 read-only:cursor-not-allowed"
        />
        <p id={HINT_ID} className="text-xs text-foreground/50">
          Entre 1 e 60 minutos.
        </p>
      </div>
    </section>
  )
}
