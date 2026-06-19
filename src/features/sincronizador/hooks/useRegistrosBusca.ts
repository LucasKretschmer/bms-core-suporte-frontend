import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { listRegistros } from '../services/sincronizadorService'

/**
 * Hook de busca de registros para manutenção.
 * A query só é ativada após submit explícito do usuário.
 * Mínimo de 2 caracteres para evitar buscas excessivas.
 */
export function useRegistrosBusca() {
  const [busca, setBusca] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const query = useQuery({
    queryKey: ['sincronizador-registros', busca],
    queryFn: () => listRegistros({ busca }),
    enabled: submitted && busca.length >= 2,
    staleTime: 30_000,
  })

  function handleBusca(valor: string) {
    setBusca(valor)
    setSubmitted(true)
  }

  function reset() {
    setBusca('')
    setSubmitted(false)
  }

  return { query, busca, handleBusca, reset }
}
