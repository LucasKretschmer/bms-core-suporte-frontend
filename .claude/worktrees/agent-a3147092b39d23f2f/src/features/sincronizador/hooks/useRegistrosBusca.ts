import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { buildBuscaParams, listRegistros } from '../services/sincronizadorService'

/**
 * Hook de busca de registros para manutenção.
 * A query só é ativada após submit explícito e termo com >= 2 caracteres
 * (backend responde 422 SEARCH_REQUIRED se a busca chegar vazia).
 * Termo numérico vira `hubspotId`; senão `search` (ver buildBuscaParams).
 */
export function useRegistrosBusca() {
  const [termo, setTermo] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const trimmed = termo.trim()
  const enabled = submitted && trimmed.length >= 2

  const query = useQuery({
    queryKey: ['sincronizador-registros', trimmed],
    queryFn: () => listRegistros(buildBuscaParams(trimmed)),
    enabled,
    staleTime: 30_000,
  })

  function handleBusca(valor: string) {
    setTermo(valor)
    setSubmitted(true)
  }

  function reset() {
    setTermo('')
    setSubmitted(false)
  }

  return { query, termo, handleBusca, reset }
}
