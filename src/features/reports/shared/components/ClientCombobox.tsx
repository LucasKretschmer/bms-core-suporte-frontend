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
}

/**
 * Combobox assíncrono para seleção de cliente.
 * Busca via GET /api/v1/clients?search= com debounce 300ms.
 * Nunca carrega todos os clientes de uma vez (lista pode ser grande — R10).
 */
export function ClientCombobox({
  value,
  onChange,
  label = 'Cliente',
  required,
  placeholder = 'Buscar cliente…',
}: ClientComboboxProps) {
  const [searchTerm, setSearchTerm] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['clients-search', searchTerm],
    queryFn: () => listClients({ search: searchTerm, page: 1, pageSize: 25 }),
    // Só busca com pelo menos 2 caracteres — evitar flood (R10)
    enabled: searchTerm.length >= 2 || value !== null,
  })

  const options =
    data?.items.map((c) => ({
      value: String(c.id),
      label: `${formatClientName(c)}${c.cnpj ? ` (${c.cnpj})` : ''}`,
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
