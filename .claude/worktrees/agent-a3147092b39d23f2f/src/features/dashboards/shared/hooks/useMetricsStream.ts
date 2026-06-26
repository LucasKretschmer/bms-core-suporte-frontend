import { useCallback, useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { tokenStore } from '../../../../utils/tokenStore'
import type { MetricsScope, MetricsStreamEventType } from '../types/metrics'

type StreamStatus = 'connecting' | 'open' | 'error' | 'closed'

type UseMetricsStreamReturn = {
  status: StreamStatus
  /** Pausa invalidações (chamar ao abrir DrillDownModal) */
  pause: () => void
  /** Retoma invalidações (chamar ao fechar DrillDownModal) */
  resume: () => void
}

const RELEVANT_EVENTS: MetricsStreamEventType[] = [
  'TIME_ENTRY_SAVED',
  'TIME_ENTRY_UPDATED',
  'TICKET_STATUS_CHANGED',
  'TICKET_CREATED',
]

/**
 * Conecta ao SSE /api/v1/metrics/stream.
 * Ao receber evento relevante → invalida queries de métricas com debounce 2s.
 * pause()/resume(): chamados pelo DrillDownModal ao abrir/fechar.
 *
 * ATENÇÃO (Risco R8): EventSource nativo não suporta header Authorization.
 * O backend aceita ?token= como alternativa. Token vem do tokenStore (memória).
 * Risco: token pode aparecer em logs de proxy — documentado como risco R8.
 */
export function useMetricsStream(scope: MetricsScope): UseMetricsStreamReturn {
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<StreamStatus>('connecting')
  const pausedRef = useRef(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const invalidateMetrics = useCallback(() => {
    if (pausedRef.current) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ['metrics-overview'] })
      queryClient.invalidateQueries({ queryKey: ['metrics-daily'] })
      queryClient.invalidateQueries({ queryKey: ['metrics-status-distribution'] })
    }, 2000)
  }, [queryClient])

  useEffect(() => {
    const token = tokenStore.get()
    const baseUrl = import.meta.env.VITE_API_URL as string
    const tokenParam = token ? `&token=${encodeURIComponent(token)}` : ''
    const url = `${baseUrl}/api/v1/metrics/stream?scope=${encodeURIComponent(scope)}${tokenParam}`

    const es = new EventSource(url)

    es.onopen = () => setStatus('open')
    es.onerror = () => setStatus('error')

    RELEVANT_EVENTS.forEach((type) => {
      es.addEventListener(type, invalidateMetrics)
    })

    return () => {
      es.close()
      setStatus('closed')
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [scope, invalidateMetrics])

  const pause = useCallback(() => {
    pausedRef.current = true
  }, [])

  const resume = useCallback(() => {
    pausedRef.current = false
  }, [])

  return { status, pause, resume }
}
