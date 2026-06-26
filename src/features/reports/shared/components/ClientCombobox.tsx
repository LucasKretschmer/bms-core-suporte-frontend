import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Combobox } from '../../../../components/ui/Combobox'
import { listClients } from '../services/reportsService'
import { formatClientName } from '../utils/formatters'

type ClientComboboxProps = {
  value: string | null
  onChange: (clientId: string | null) => void
  label?: string
  required?: boolean
  placeholder?: string
  /**
   * Exibe o CNPJ entre parênteses no rótulo da opção (ex.: "Acme (12.345.678/0001-90)").
   * Default `true` para manter o comportamento dos relatórios (010/011/U5).
   * A busca por CNPJ é server-side e independe deste flag — desligar só altera a exibição.
   */
  showCnpj?: boolean
}

/**
 * Combobox assíncrono para seleção de cliente.
 * Carga inicial (search vazio) lista os primeiros 25 clientes ao abrir;
 * ao digitar, a busca é server-side com debounce de 300ms (gerenciado pelo Combobox).
 * Nunca carrega todos os clientes de uma vez (lista pode ser grande — R10): pageSize=25.
 */
export function ClientCombobox({
  value,
  onChange,
  label = 'Cliente',
  required,
  placeholder = 'Buscar cliente…',
  showCnpj = true,
}: ClientComboboxProps) {
  const [searchTerm, setSearchTerm] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['clients-search', searchTerm],
    queryFn: () => listClients({ search: searchTerm, page: 1, pageSize: 25 }),
    // Carga inicial lista os primeiros 25; ao digitar, busca server-side (debounce no Combobox).
    enabled: true,
    // staleTime curto evita refetch agressivo a cada reabertura do dropdown.
    staleTime: 60 * 1000,
  })

  const options =
    data?.items.map((c) => ({
      value: String(c.id),
      // CNPJ no rótulo é só exibição; a busca por CNPJ é server-side (ver doc do componente).
      label:
        showCnpj && c.cnpj
          ? `${formatClientName(c)} (${c.cnpj})`
          : formatClientName(c),
    })) ?? []

  function handleSearch(query: string) {
    setSearchTerm(query)
  }

  function handleChange(val: string) {
    onChange(val || null)
  }

  return (
    <Combobox
      value={value}
      options={options}
      onChange={handleChange}
      label={label}
      required={required}
      placeholder={placeholder}
      isAsync
      onSearch={handleSearch}
      isLoading={isLoading}
    />
  )
}
