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
    // 124/QA D-8 — esta chave era `['support-plans']`, a MESMA de
    // `features/support-plans/hooks/useSupportPlans.ts`, com uma `queryFn` diferente e um
    // `SupportPlanDto` diferente (o daqui não tem os 5 campos de 124 nem
    // `clientesVinculados`). Mesma chave = MESMA entrada de cache: quem buscasse primeiro
    // decidia o objeto que o outro lia, e o erro apareceria como campo faltando em runtime,
    // sem erro de tipo — cada lado está corretamente tipado do seu lado.
    //
    // Os dois tipos continuam separados de propósito: o `SupportPlanDto` daqui também
    // descreve o plano EMBUTIDO em `ClientDetailDto`/relatório do cliente, onde o backend
    // documenta que `ClientesVinculados` sai 0 ("nao leia este campo fora de
    // /support-plans" — `SupportPlanDtos.cs:30-35`). Alargá-lo aqui seria afirmar sobre
    // `/clients/{id}` uma coisa que não é verdade.
    //
    // O sufixo mantém o PREFIXO `['support-plans']`, então a invalidação por prefixo de
    // `useSupportPlanMutations` continua alcançando este combobox depois de criar/renomear
    // um plano. `utils/queryKeyRegistry.test.ts` reprova se as duas voltarem a colidir.
    queryKey: ['support-plans', 'options'],
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
