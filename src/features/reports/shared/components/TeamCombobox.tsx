import { useQuery } from '@tanstack/react-query'
import type { ComboboxOption } from '../../../../components/ui/Combobox'
import { Combobox } from '../../../../components/ui/Combobox'
import { listTeams } from '../services/reportsService'

type TeamComboboxProps = {
  value: string | null
  onChange: (teamId: string | null) => void
  label?: string
  placeholder?: string
}

/**
 * Combobox de equipes — lista pequena, carrega tudo de uma vez.
 * Inclui opção "Todas as equipes".
 */
export function TeamCombobox({
  value,
  onChange,
  label = 'Equipe',
  placeholder = 'Todas as equipes',
}: TeamComboboxProps) {
  const { data } = useQuery({
    queryKey: ['teams'],
    queryFn: listTeams,
    staleTime: 5 * 60 * 1000, // 5 minutos — lista estável
  })

  const options: ComboboxOption[] = [
    { value: '', label: 'Todas as equipes' },
    ...(data ?? []).map((t) => ({ value: String(t.id), label: t.nome })),
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
