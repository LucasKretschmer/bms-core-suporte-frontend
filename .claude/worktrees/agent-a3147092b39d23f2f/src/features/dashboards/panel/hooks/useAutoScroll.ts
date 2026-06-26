import { useCallback, useEffect, useRef } from 'react'

type UseAutoScrollOptions = {
  containerRef: React.RefObject<HTMLElement | null>
  totalMs: number
  enabled: boolean
}

type UseAutoScrollReturn = {
  /** Volta ao topo e reinicia o timer (chamar ao trocar de equipe) */
  reset: () => void
}

/**
 * Auto-scroll de página no Modo Painel.
 * Fases: 35% topo → 30% rolando suavemente → 35% final → loop.
 * Usa requestAnimationFrame. Respeita prefers-reduced-motion.
 * containerRef: elemento a rolar.
 * totalMs: duração total de uma passagem (= intervalMs do usePanelRotation).
 */
export function useAutoScroll({
  containerRef,
  totalMs,
  enabled,
}: UseAutoScrollOptions): UseAutoScrollReturn {
  const startTimeRef = useRef<number | null>(null)
  const rafRef = useRef<number | null>(null)

  const prefersReducedMotion =
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false

  const stop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    startTimeRef.current = null
  }, [])

  const reset = useCallback(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = 0
    }
    startTimeRef.current = null
  }, [containerRef])

  useEffect(() => {
    if (!enabled) {
      stop()
      return
    }

    const container = containerRef.current
    if (!container) return

    const phase1 = 0.35 * totalMs
    const phase2 = 0.30 * totalMs

    function tick(now: number) {
      if (!container) return

      if (startTimeRef.current === null) {
        startTimeRef.current = now
      }

      const elapsed = now - startTimeRef.current
      const maxScroll = container.scrollHeight - container.clientHeight

      if (prefersReducedMotion) {
        // Vai direto para o final sem animação
        container.scrollTop = maxScroll
        return
      }

      if (elapsed < phase1) {
        // Fase 1: parado no topo
        container.scrollTop = 0
      } else if (elapsed < phase1 + phase2) {
        // Fase 2: rolando suavemente
        const scrollProgress = (elapsed - phase1) / phase2
        container.scrollTop = scrollProgress * maxScroll
      } else {
        // Fase 3: parado no final
        container.scrollTop = maxScroll
      }

      if (elapsed < totalMs) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        // Loop: reinicia
        startTimeRef.current = null
        container.scrollTop = 0
        rafRef.current = requestAnimationFrame(tick)
      }
    }

    rafRef.current = requestAnimationFrame(tick)

    return stop
  }, [enabled, totalMs, containerRef, prefersReducedMotion, stop])

  return { reset }
}
