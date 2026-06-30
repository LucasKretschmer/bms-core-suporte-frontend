/**
 * Modo Painel — overlay fullscreen do dashboard, fiel ao protótipo (demanda 014).
 *
 * Comportamento espelhado de `dPresent`/`panelSlide`/`dStopPanel` (Suporte) e
 * `dPresentOnb`/`panelOnbTick` (Onboarding):
 * - entra em fullscreen no DOCUMENTO inteiro (e funciona mesmo se for negado);
 * - esconde TODO o chrome (overlay `fixed inset-0`; a página oculta filtros/sidebar);
 * - rotaciona a equipe trocando o `scope` (Onboarding passa `teams=[]` = sem rotação);
 * - auto-scroll 35% topo / 30% rolando / 35% fim por tela, em loop;
 * - nome da equipe em destaque DENTRO do conteúdo rolável (PanelTitle ≈ `.dtitle`);
 * - encerra com Escape OU ao sair do fullscreen (botão do browser).
 *
 * NÃO há setas prev/next nem barra de progresso — o protótipo não os tem.
 *
 * AP-FRONTEND-002: target="_blank" com rel="noopener noreferrer" (n/a aqui).
 * AP-FRONTEND-003: useId() nos elementos interativos reutilizáveis.
 */

import { useCallback, useEffect, useId, useRef } from 'react'
import { useFullscreen } from './hooks/useFullscreen'
import { usePanelRotation } from './hooks/usePanelRotation'
import { useAutoScroll } from './hooks/useAutoScroll'
import { PanelTitle } from './components/PanelTitle'
import type { MetricsScope, TeamDto } from '../shared/types/metrics'

type LiveStatus = 'connecting' | 'open' | 'error' | 'closed'

type PanelModeProps = {
  isActive: boolean
  onExit: () => void
  /** Lista de rotação JÁ filtrada (Global + equipes de Suporte). `[]` = sem rotação. */
  teams: TeamDto[]
  scope: MetricsScope
  onScopeChange: (scope: MetricsScope) => void
  from: string | null
  to: string | null
  /** Tempo por tela em ms (rotação E scroll). Default 12s. */
  intervalMs?: number
  /** Índice inicial da rotação (equipe corrente da página). Default 0. */
  initialIndex?: number
  /** Rótulo do escopo exibido no título (ex.: "Suporte", "Onboarding"). */
  scopeLabel?: string
  liveStatus?: LiveStatus
  /** Conteúdo do dashboard (sem filtros, sem sidebar). */
  children: React.ReactNode
}

const DEFAULT_INTERVAL_MS = 12_000

export function PanelMode({
  isActive,
  onExit,
  teams,
  scope,
  onScopeChange,
  from,
  to,
  intervalMs = DEFAULT_INTERVAL_MS,
  initialIndex = 0,
  scopeLabel = 'Suporte',
  liveStatus = 'closed',
  children,
}: PanelModeProps) {
  const panelId = useId()
  const containerRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const exitButtonRef = useRef<HTMLButtonElement>(null)

  const { enter, exit } = useFullscreen()

  // onExit estável para os listeners globais (Escape / fullscreenchange).
  const onExitRef = useRef(onExit)
  onExitRef.current = onExit

  // (BUG 051) Marca se o painel REALMENTE entrou em fullscreen.
  // No iframe do BMS Core (sem `allow="fullscreen"`) o `requestFullscreen` é negado:
  // não devemos tratar `fullscreenchange` como "saída" porque nunca houve entrada.
  // Sem essa guarda, o ciclo entrar→falhar→evento encerra o painel logo após abrir
  // ("clico e nada acontece"). Só encerramos por fullscreenchange se havíamos entrado.
  const didEnterFullscreenRef = useRef(false)

  const handleExit = useCallback(() => {
    void exit()
    onExitRef.current()
  }, [exit])

  // Entra em fullscreen ao ativar o painel (best-effort; o painel NÃO depende do sucesso).
  useEffect(() => {
    if (!isActive) return
    let cancelled = false
    void enter().then(() => {
      // Só consideramos "entrou" se o browser realmente colocou o documento em fullscreen.
      if (!cancelled && document.fullscreenElement) {
        didEnterFullscreenRef.current = true
      }
    })
    containerRef.current?.focus()
    return () => {
      cancelled = true
      didEnterFullscreenRef.current = false
    }
  }, [isActive, enter])

  // (BUG 051) Encerrar o painel ao sair do fullscreen (botão do browser) e com Escape.
  // - Escape SEMPRE encerra: é a fonte de verdade do overlay, funcione ou não o fullscreen.
  // - fullscreenchange só encerra se ANTES tínhamos entrado em fullscreen de fato. No iframe,
  //   onde o fullscreen é bloqueado, eventos espúrios de fullscreenchange (ex.: o pai sai do
  //   fullscreen) não devem derrubar o painel recém-aberto.
  useEffect(() => {
    if (!isActive) return

    function onFullscreenChange() {
      // Saiu do fullscreen DEPOIS de ter entrado de fato → encerrar.
      if (didEnterFullscreenRef.current && !document.fullscreenElement) {
        didEnterFullscreenRef.current = false
        onExitRef.current()
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        void exit()
        onExitRef.current()
      }
    }

    document.addEventListener('fullscreenchange', onFullscreenChange)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [isActive, exit])

  // Rotação de equipes (espelha panelSlide; inicia no scope corrente).
  const rotation = usePanelRotation({
    teams,
    intervalMs,
    initialIndex,
    onScopeChange,
  })

  // Auto-scroll 35/30/35 sincronizado com o tempo por tela.
  const { reset: resetScroll } = useAutoScroll({
    containerRef: contentRef,
    totalMs: intervalMs,
    enabled: isActive,
  })

  // Ao trocar de equipe: volta ao topo (≈ scrollTop0() em panelSlide).
  useEffect(() => {
    if (isActive) {
      resetScroll()
    }
  }, [rotation.currentIndex, isActive, resetScroll])

  // Período formatado para o rótulo do título.
  const periodLabel =
    from && to
      ? `${from.split('-').reverse().join('/')} – ${to.split('-').reverse().join('/')}`
      : '—'

  // Nome da equipe corrente: da rotação quando há equipes; senão derivado do scope.
  const currentTeamName = (() => {
    if (teams.length > 0 && rotation.currentTeam) {
      // id sentinel 0 = Global
      return rotation.currentTeam.id ? rotation.currentTeam.nome : 'Global'
    }
    if (scope === 'management:onboarding') return 'Onboarding'
    if (scope === 'management:suporte' || scope === 'global') return 'Global'
    if (scope.startsWith('team:')) {
      const teamId = scope.slice(5)
      const found = teams.find((t) => String(t.id) === teamId)
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
      {/* Botão de saída — canto superior direito, sobre o conteúdo. */}
      <button
        ref={exitButtonRef}
        type="button"
        onClick={handleExit}
        aria-label="Sair do Modo Painel (Esc)"
        className="absolute top-3 right-4 z-10 rounded p-1 text-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
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

      {/* Conteúdo rolável — título da equipe + seções (auto-scroll atua aqui). */}
      <div ref={contentRef} className="min-h-0 flex-1 overflow-y-auto px-8 py-6">
        <PanelTitle
          teamName={currentTeamName}
          scopeLabel={`${scopeLabel} · ${periodLabel}`}
          liveStatus={liveStatus}
        />
        {children}
      </div>
    </div>
  )
}
