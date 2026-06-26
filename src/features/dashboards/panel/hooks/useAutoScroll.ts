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
 * Auto-scroll de página no Modo Painel — espelha `smoothScrollBottom` do protótipo.
 * Fases por tela: 35% parado no topo → 30% rolando suavemente → 35% parado no fim → loop.
 * `totalMs` = tempo por tela (= intervalMs da rotação), para casar com a troca de equipe.
 *
 * Robustez (riscos 3/5 da arquitetura):
 * - a posição é calculada por TEMPO decorrido (não por delta de frame), então um
 *   re-render por live update no meio da rolagem reposiciona corretamente no próximo
 *   frame, sem resetar o scroll;
 * - o rAF é sempre cancelado no cleanup e o step verifica o container a cada frame;
 * - respeita prefers-reduced-motion (pula direto para o fim, sem animar).
 */
export function useAutoScroll({
  containerRef,
  totalMs,
  enabled,
}: UseAutoScrollOptions): UseAutoScrollReturn {
  const startTimeRef = useRef<number | null>(null)
  const rafRef = useRef<number | null>(null)

  const prefersReducedMotion =
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
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
      // Ao desligar o painel: garante o scroll de volta ao topo (≈ scrollTop0()).
      if (containerRef.current) containerRef.current.scrollTop = 0
      return
    }

    const phase1 = 0.35 * totalMs
    const phase2 = 0.30 * totalMs

    function tick(now: number) {
      const container = containerRef.current
      if (!container) {
        // Container ainda não montado/desmontado — tenta no próximo frame.
        rafRef.current = requestAnimationFrame(tick)
        return
      }

      if (startTimeRef.current === null) {
        startTimeRef.current = now
      }

      const elapsed = now - startTimeRef.current
      const maxScroll = Math.max(0, container.scrollHeight - container.clientHeight)

      if (prefersReducedMotion) {
        // Sem animação: vai direto para o fim e mantém (loop só de tempo).
        container.scrollTop = maxScroll
      } else if (elapsed < phase1) {
        // Fase 1: parado no topo (35%)
        container.scrollTop = 0
      } else if (elapsed < phase1 + phase2) {
        // Fase 2: rolagem suave (30%)
        const scrollProgress = (elapsed - phase1) / phase2
        container.scrollTop = scrollProgress * maxScroll
      } else {
        // Fase 3: parado no fim (35%)
        container.scrollTop = maxScroll
      }

      if (elapsed >= totalMs) {
        // Loop: reinicia a contagem e volta ao topo.
        startTimeRef.current = null
        container.scrollTop = 0
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)

    return stop
  }, [enabled, totalMs, containerRef, prefersReducedMotion, stop])

  return { reset }
}
