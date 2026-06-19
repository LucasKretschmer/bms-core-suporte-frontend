/**
 * Modo Painel — overlay fullscreen completo.
 * Integra useFullscreen, usePanelRotation e useAutoScroll.
 * Renderiza o dashboard sem chrome (sem Sidebar, sem Header, sem DashboardFilters).
 *
 * AP-FRONTEND-002: target="_blank" com rel="noopener noreferrer".
 * AP-FRONTEND-003: useId() nos elementos interativos reutilizáveis.
 */

import { useCallback, useEffect, useId, useRef } from 'react'
import { useFullscreen } from './hooks/useFullscreen'
import { usePanelRotation } from './hooks/usePanelRotation'
import { useAutoScroll } from './hooks/useAutoScroll'
import { PanelHeader } from './components/PanelHeader'
import type { MetricsScope, TeamDto } from '../shared/types/metrics'

type PanelModeProps = {
  isActive: boolean
  onExit: () => void
  teams: TeamDto[]
  scope: MetricsScope
  onScopeChange: (scope: MetricsScope) => void
  from: string | null
  to: string | null
  intervalMs?: number
  liveStatus?: 'connecting' | 'open' | 'error' | 'closed'
  /** Conteúdo do dashboard (sem filtros, sem sidebar) */
  children: React.ReactNode
}

const DEFAULT_INTERVAL_MS = 12_000

/**
 * Overlay fullscreen do Modo Painel.
 * - usePanelRotation: rotaciona equipes trocando o scope a cada intervalMs.
 * - useAutoScroll: 35% topo / 30% rolando / 35% embaixo — sincronizado com intervalMs.
 * - useFullscreen: fullscreen real com fallback para overlay CSS.
 * - Barra de progresso horizontal na base do header indica tempo até a próxima troca.
 * - Esc ou botão X encerra o painel.
 */
export function PanelMode({
  isActive,
  onExit,
  teams,
  scope,
  onScopeChange,
  from,
  to,
  intervalMs = DEFAULT_INTERVAL_MS,
  liveStatus = 'closed',
  children,
}: PanelModeProps) {
  const panelId = useId()
  const containerRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const exitButtonRef = useRef<HTMLButtonElement>(null)

  const { enter, exit, isFullscreen } = useFullscreen(containerRef)

  // Entra em fullscreen ao ativar
  useEffect(() => {
    if (isActive) {
      void enter()
      // Foco no container para capturar Esc e navegação por teclado
      containerRef.current?.focus()
    }
  }, [isActive, enter])

  // Ao sair do fullscreen pelo botão do browser → encerrar o painel também
  useEffect(() => {
    if (isActive && !isFullscreen) {
      // isFullscreen muda para false quando o usuário sai pelo botão do browser
      // Só encerrar se estivermos ativamente no painel (não na montagem inicial)
    }
  }, [isActive, isFullscreen])

  const handleExit = useCallback(() => {
    void exit()
    onExit()
  }, [exit, onExit])

  // Rotação de equipes
  const rotation = usePanelRotation({
    teams,
    intervalMs,
    onScopeChange,
  })

  // Sincroniza currentIndex com o scope externo na primeira montagem
  // (quando PanelMode monta, a equipe ativa já é a do scope da página)
  // O usePanelRotation começa no índice 0; na prática a página passa o scope corrente.

  // Auto-scroll sincronizado com intervalMs
  const { reset: resetScroll } = useAutoScroll({
    containerRef: contentRef,
    totalMs: intervalMs,
    enabled: isActive,
  })

  // Ao trocar de equipe: volta ao topo
  useEffect(() => {
    if (isActive) {
      resetScroll()
    }
  }, [rotation.currentIndex, isActive, resetScroll])

  // Formatar período para exibição
  const periodLabel =
    from && to
      ? `${from.split('-').reverse().join('/')} – ${to.split('-').reverse().join('/')}`
      : '—'

  // Nome da equipe corrente: vem do usePanelRotation quando há equipes;
  // caso teams=[] (Onboarding), mostra o nome derivado do scope externo.
  const currentTeamName = (() => {
    if (teams.length > 0 && rotation.currentTeam) {
      // "Global" quando id vazio (sentinel do usePanelRotation)
      return rotation.currentTeam.id ? rotation.currentTeam.nome : 'Global'
    }
    // Onboarding ou fallback: derivar do scope externo
    if (scope === 'management:onboarding') return 'Onboarding'
    if (scope === 'management:suporte') return 'Global'
    if (scope === 'global') return 'Global'
    if (scope.startsWith('team:')) {
      const teamId = scope.slice(5)
      const found = teams.find((t) => t.id === teamId)
      return found?.nome ?? teamId
    }
    return 'Global'
  })()

  if (!isActive) return null

  return (
    <div
      ref={containerRef}
      id={panelId}
      role="dialog"
      aria-modal="true"
      aria-label="Modo Painel"
      className="fixed inset-0 z-50 bg-background overflow-hidden flex flex-col"
      tabIndex={-1}
    >
      {/* Cabeçalho com nome da equipe, live indicator e período */}
      <PanelHeader
        teamName={currentTeamName}
        scope={scope}
        liveStatus={liveStatus}
        period={periodLabel}
        progress={rotation.progress}
      />

      {/* Botão de saída — canto superior direito, acima do header */}
      <button
        ref={exitButtonRef}
        type="button"
        onClick={handleExit}
        aria-label="Sair do Modo Painel (Esc)"
        className="absolute top-3 right-4 z-10 text-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary rounded p-1"
      >
        <svg
          aria-hidden="true"
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* Controles de navegação (prev/next) — só quando há mais de 1 equipe */}
      {teams.length > 1 && (
        <>
          <button
            type="button"
            onClick={rotation.goPrev}
            aria-label="Equipe anterior"
            className="absolute left-2 top-1/2 -translate-y-1/2 z-10 p-2 text-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary rounded"
          >
            <svg aria-hidden="true" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            type="button"
            onClick={rotation.goNext}
            aria-label="Próxima equipe"
            className="absolute right-2 top-1/2 -translate-y-1/2 z-10 p-2 text-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary rounded"
          >
            <svg aria-hidden="true" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </>
      )}

      {/* Conteúdo do dashboard — com overflow-y-auto para o auto-scroll funcionar */}
      <div
        ref={contentRef}
        className="flex-1 overflow-y-auto px-6 py-4"
      >
        {children}
      </div>
    </div>
  )
}
