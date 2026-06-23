import { useQuery } from '@tanstack/react-query'
import type { ComboboxOption } from '../../../../components/ui/Combobox'
import { Combobox } from '../../../../components/ui/Combobox'
import { listSupportPlans } from '../services/reportsService'

type PlanComboboxProps = {
  value: string | null
  onChange: (planId: string | null) => void
  label?: string
  placeholder?: string
}

/**
 * Combobox de planos de suporte — usado em U3 (Consumo de Planos).
 * Inclui opção "Todos os planos".
 */
export function PlanCombobox({
  value,
  onChange,
  label = 'Plano',
  placeholder = 'Todos os planos',
}: PlanComboboxProps) {
  const { data } = useQuery({
    queryKey: ['support-plans'],
    queryFn: listSupportPlans,
    staleTime: 5 * 60 * 1000,
  })

  const options: ComboboxOption[] = [
    { value: '', label: 'Todos os planos' },
    ...(data ?? []).map((p) => ({ value: String(p.id), label: p.nome })),
  ]

  return (
    <Combobox
      value={value ?? ''}
      options={options}
      onChange={(v) => onChange(v || null)}
      label={label}
      placeholder={placeholder}
    />
  )
}
