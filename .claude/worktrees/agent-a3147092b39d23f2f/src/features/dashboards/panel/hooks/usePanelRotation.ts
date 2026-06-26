import { useCallback, useEffect, useRef, useState } from 'react'
import type { MetricsScope, TeamDto } from '../../shared/types/metrics'

type UsePanelRotationOptions = {
  teams: TeamDto[]
  intervalMs?: number
  onScopeChange: (scope: MetricsScope) => void
}

type UsePanelRotationReturn = {
  currentTeam: TeamDto | null
  currentIndex: number
  /** 0–1 indicando progresso até a próxima troca */
  progress: number
  goNext: () => void
  goPrev: () => void
  pause: () => void
  resume: () => void
  isPaused: boolean
}

const DEFAULT_INTERVAL_MS = 12_000

/**
 * Gerencia rotação de equipe no Modo Painel.
 * teams: lista de equipes (com "Global" como primeiro item quando aplicável).
 * intervalMs: tempo por tela (default 12s).
 * onScopeChange: callback ao trocar — atualiza o scope das queries.
 *
 * Onboarding não usa rotação — teams=[] não chama onScopeChange.
 */
export function usePanelRotation({
  teams,
  intervalMs = DEFAULT_INTERVAL_MS,
  onScopeChange,
}: UsePanelRotationOptions): UsePanelRotationReturn {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [progress, setProgress] = useState(0)
  const [isPaused, setIsPaused] = useState(false)

  const pausedRef = useRef(false)
  const startTimeRef = useRef<number>(Date.now())
  const rafRef = useRef<number | null>(null)
  const onScopeChangeRef = useRef(onScopeChange)
  onScopeChangeRef.current = onScopeChange

  const indexRef = useRef(currentIndex)
  indexRef.current = currentIndex

  const buildScope = useCallback(
    (idx: number): MetricsScope => {
      if (teams.length === 0) return 'management:suporte'
      const team = teams[idx]
      if (!team) return 'management:suporte'
      // Primeira posição com id '' = Global
      if (!team.id) return 'management:suporte'
      return `team:${team.id}` as MetricsScope
    },
    [teams],
  )

  const advanceTo = useCallback(
    (nextIdx: number) => {
      const clamped = ((nextIdx % teams.length) + teams.length) % teams.length
      setCurrentIndex(clamped)
      indexRef.current = clamped
      setProgress(0)
      startTimeRef.current = Date.now()
      if (teams.length > 0) {
        onScopeChangeRef.current(buildScope(clamped))
      }
    },
    [teams.length, buildScope],
  )

  // Loop de progresso via rAF
  useEffect(() => {
    if (teams.length <= 1) return // Sem rotação com 0 ou 1 equipe

    function tick() {
      if (!pausedRef.current) {
        const elapsed = Date.now() - startTimeRef.current
        const pct = Math.min(elapsed / intervalMs, 1)
        setProgress(pct)

        if (pct >= 1) {
          const next = ((indexRef.current + 1) % teams.length)
          advanceTo(next)
        }
      }
      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [teams.length, intervalMs, advanceTo])

  const goNext = useCallback(() => {
    if (teams.length === 0) return
    advanceTo(indexRef.current + 1)
  }, [teams.length, advanceTo])

  const goPrev = useCallback(() => {
    if (teams.length === 0) return
    advanceTo(indexRef.current - 1)
  }, [teams.length, advanceTo])

  const pause = useCallback(() => {
    pausedRef.current = true
    setIsPaused(true)
  }, [])

  const resume = useCallback(() => {
    pausedRef.current = false
    setIsPaused(false)
    startTimeRef.current = Date.now() - progress * intervalMs
  }, [progress, intervalMs])

  const currentTeam = teams.length > 0 ? (teams[currentIndex] ?? null) : null

  return {
    currentTeam,
    currentIndex,
    progress,
    goNext,
    goPrev,
    pause,
    resume,
    isPaused,
  }
}
