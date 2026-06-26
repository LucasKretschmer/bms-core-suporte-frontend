import { useCallback, useEffect, useRef, useState } from 'react'
import type { MetricsScope, TeamDto } from '../../shared/types/metrics'

type UsePanelRotationOptions = {
  /**
   * Lista de rotação JÁ filtrada pela página (Global + equipes de Suporte,
   * SEM Integração/Customer Success). Onboarding passa `teams=[]` para desligar
   * a rotação. Item Global tem `id=0` (sentinel) → scope 'management:suporte'.
   */
  teams: TeamDto[]
  intervalMs?: number
  /**
   * Índice inicial da rotação. Espelha `S._pi = indexOf(dashTeam)` do protótipo:
   * a apresentação começa na equipe ATUAL da página, não no índice 0.
   */
  initialIndex?: number
  onScopeChange: (scope: MetricsScope) => void
}

type UsePanelRotationReturn = {
  currentTeam: TeamDto | null
  currentIndex: number
}

const DEFAULT_INTERVAL_MS = 12_000

/**
 * Rotação de equipe no Modo Painel (espelha `panelSlide` do protótipo).
 * - Avança para a próxima tela a cada `intervalMs` e faz loop infinito.
 * - Começa em `initialIndex` (equipe corrente da página), não no índice 0.
 * - `teams=[]` ou `teams.length<=1` → sem rotação (Onboarding / tela única).
 *
 * Sem setas prev/next nem barra de progresso: o protótipo não os tem (demanda 014).
 */
export function usePanelRotation({
  teams,
  intervalMs = DEFAULT_INTERVAL_MS,
  initialIndex = 0,
  onScopeChange,
}: UsePanelRotationOptions): UsePanelRotationReturn {
  // Clampa o índice inicial para a faixa válida da lista.
  const safeInitialIndex =
    teams.length > 0
      ? ((initialIndex % teams.length) + teams.length) % teams.length
      : 0

  const [currentIndex, setCurrentIndex] = useState(safeInitialIndex)

  const indexRef = useRef(currentIndex)
  indexRef.current = currentIndex

  const onScopeChangeRef = useRef(onScopeChange)
  onScopeChangeRef.current = onScopeChange

  const buildScope = useCallback(
    (idx: number): MetricsScope => {
      const team = teams[idx]
      // Sem equipe ou Global (id sentinel 0/'') → escopo de gerência Suporte.
      if (!team || !team.id) return 'management:suporte'
      return `team:${team.id}` as MetricsScope
    },
    [teams],
  )

  // Avanço automático por tempo (espelha o setTimeout de troca do protótipo).
  // Usa setInterval para alinhar com a mesma fonte de tempo do auto-scroll.
  useEffect(() => {
    if (teams.length <= 1) return // 0 ou 1 tela → sem rotação

    const timer = setInterval(() => {
      const next = (indexRef.current + 1) % teams.length
      indexRef.current = next
      setCurrentIndex(next)
      onScopeChangeRef.current(buildScope(next))
    }, intervalMs)

    return () => clearInterval(timer)
  }, [teams.length, intervalMs, buildScope])

  const currentTeam = teams.length > 0 ? (teams[currentIndex] ?? null) : null

  return {
    currentTeam,
    currentIndex,
  }
}
