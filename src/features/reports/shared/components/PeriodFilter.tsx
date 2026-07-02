import { Input } from '../../../../components/ui/Input'
import { isRangeValid, normalizeDateOnCommit } from '../../../../utils/dateValidation'

type PeriodFilterProps = {
  from: string | null
  to: string | null
  onChange: (from: string | null, to: string | null) => void
  mode?: 'date' | 'month'
  labelFrom?: string
  labelTo?: string
}

const RANGE_ERROR = 'A data inicial não pode ser maior que a data final.'

/**
 * Filtro de período.
 * mode="date": inputs type=date (YYYY-MM-DD).
 * mode="month": inputs type=month (YYYY-MM) — usado em U5 (Relatório do Cliente).
 *
 * Validação (100), self-contained e aditiva (não altera a assinatura `onChange`):
 *  - **Auto-correção de dia impossível** (ex.: 2026-06-31 → 2026-06-30) no commit
 *    (onBlur), via `normalizeDateOnCommit` (clamp com date-fns). Não roda a cada
 *    tecla para não atrapalhar a digitação em input nativo.
 *  - **Erro inline** quando `from > to` ("A data inicial não pode ser maior que a
 *    data final."), discreto e com `role="alert"`. A propagação continua a mesma;
 *    o backend barra `início > fim` com 422 como rede de segurança.
 */
export function PeriodFilter({
  from,
  to,
  onChange,
  mode = 'date',
  labelFrom = mode === 'month' ? 'De (mês)' : 'De',
  labelTo = mode === 'month' ? 'Até (mês)' : 'Até',
}: PeriodFilterProps) {
  const inputType = mode === 'month' ? 'month' : 'date'
  const rangeInvalid = !isRangeValid(from, to)

  // Commit do campo "De": normaliza (clamp) e propaga se a correção mudou o valor.
  const commitFrom = (raw: string) => {
    const value = raw || null
    const normalized = normalizeDateOnCommit(value)
    if (normalized !== from) onChange(normalized, to)
  }

  const commitTo = (raw: string) => {
    const value = raw || null
    const normalized = normalizeDateOnCommit(value)
    if (normalized !== to) onChange(from, normalized)
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-end gap-3">
        <Input
          label={labelFrom}
          type={inputType}
          value={from ?? ''}
          onChange={(e) => onChange(e.target.value || null, to)}
          onBlur={(e) => commitFrom(e.target.value)}
          aria-invalid={rangeInvalid || undefined}
          className="min-w-[140px]"
        />
        <Input
          label={labelTo}
          type={inputType}
          value={to ?? ''}
          onChange={(e) => onChange(from, e.target.value || null)}
          onBlur={(e) => commitTo(e.target.value)}
          aria-invalid={rangeInvalid || undefined}
          className="min-w-[140px]"
        />
      </div>
      {rangeInvalid && (
        <p className="text-xs text-error-fg" role="alert">
          {RANGE_ERROR}
        </p>
      )}
    </div>
  )
}
