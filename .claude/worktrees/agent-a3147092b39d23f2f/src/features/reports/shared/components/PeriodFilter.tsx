import { Input } from '../../../../components/ui/Input'

type PeriodFilterProps = {
  from: string | null
  to: string | null
  onChange: (from: string | null, to: string | null) => void
  mode?: 'date' | 'month'
  labelFrom?: string
  labelTo?: string
}

/**
 * Filtro de período.
 * mode="date": inputs type=date (YYYY-MM-DD).
 * mode="month": inputs type=month (YYYY-MM) — usado em U5 (Relatório do Cliente).
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

  return (
    <div className="flex items-end gap-3">
      <Input
        label={labelFrom}
        type={inputType}
        value={from ?? ''}
        onChange={(e) => onChange(e.target.value || null, to)}
        className="min-w-[140px]"
      />
      <Input
        label={labelTo}
        type={inputType}
        value={to ?? ''}
        onChange={(e) => onChange(from, e.target.value || null)}
        className="min-w-[140px]"
      />
    </div>
  )
}
