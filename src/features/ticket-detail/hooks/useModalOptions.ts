import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { ComboboxOption } from '../../../components/ui/Combobox'
import { forcaCobrancaForaDoPlano } from '../../service-categories/types/serviceCategory'
import {
  listActiveCategoryOptions,
  listAgentOptions,
} from '../services/modalOptionsService'

/**
 * Opções dos combos do modal (atendente e categorização ativa).
 * Carregadas sob demanda — só quando o modal está aberto (enabled).
 */
export function useModalOptions(enabled: boolean) {
  const agents = useQuery({
    queryKey: ['agent-options'],
    queryFn: listAgentOptions,
    enabled,
  })

  const categories = useQuery({
    queryKey: ['category-options-active'],
    queryFn: listActiveCategoryOptions,
    enabled,
  })

  const agentOptions: ComboboxOption[] = (agents.data ?? []).map((a) => ({
    value: String(a.userId),
    label: a.equipeNome ? `${a.nome} · ${a.equipeNome}` : a.nome,
  }))

  const categoryOptions: ComboboxOption[] = (categories.data ?? []).map((c) => ({
    value: String(c.id),
    label: c.nome,
  }))

  /**
   * 133 — ids (como **string**, casando com `ComboboxOption.value`) das categorias que
   * forçam cobrança fora do plano.
   *
   * Por que um índice **ao lado** e não um campo dentro de `categoryOptions`: o `map`
   * acima é uma **projeção** para `ComboboxOption = { value, label }`
   * (`components/ui/Combobox.tsx:4`) — campo que não entra nele fica invisível **sem
   * erro, sem log e sem teste vermelho**, que é exatamente o defeito que a 133 existe
   * para não repetir. E o tipo `ComboboxOption` é compartilhado por 10 consumidores (dois
   * deles de relatório, demandas 132/134): não comporta campo de domínio.
   *
   * O fio até o consumidor é provado pelo **compilador**: a prop `categoriasQueForcam` do
   * `TimeEntryModal` é obrigatória, então esquecer de ligá-la reprova o `tsc -b`.
   */
  const categoriasQueForcam: ReadonlySet<string> = useMemo(
    () =>
      new Set(
        (categories.data ?? [])
          .filter((c) => forcaCobrancaForaDoPlano(c))
          .map((c) => String(c.id)),
      ),
    [categories.data],
  )

  return {
    agentOptions,
    categoryOptions,
    categoriasQueForcam,
    isLoading: agents.isLoading || categories.isLoading,
    isError: agents.isError || categories.isError,
  }
}
