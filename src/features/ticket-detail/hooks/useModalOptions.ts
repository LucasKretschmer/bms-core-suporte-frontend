import { useQuery } from '@tanstack/react-query'
import type { ComboboxOption } from '../../../components/ui/Combobox'
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
    value: a.userId,
    label: a.equipeNome ? `${a.nome} · ${a.equipeNome}` : a.nome,
  }))

  const categoryOptions: ComboboxOption[] = (categories.data ?? []).map((c) => ({
    value: c.id,
    label: c.nome,
  }))

  return {
    agentOptions,
    categoryOptions,
    isLoading: agents.isLoading || categories.isLoading,
    isError: agents.isError || categories.isError,
  }
}
