/**
 * Cabeçalho do Modo Painel.
 * Exibe nome da equipe em destaque, LiveIndicator, período e barra de progresso.
 * teamName NUNCA hardcoded — vem de TeamDto.nome ou derivado do scope.
 * AP-FRONTEND-002: target="_blank" com rel="noopener noreferrer".
 */

import { LiveIndicator } from '../../shared/components/LiveIndicator'
import type { MetricsScope } from '../../shared/types/metrics'

type LiveStatus = 'connecting' | 'open' | 'error' | 'closed'

type PanelHeaderProps = {
  /** Nome da equipe corrente — NUNCA hardcoded, vem de TeamDto.nome */
  teamName: string
  /** Scope corrente (para acessibilidade) */
  scope: MetricsScope
  liveStatus: LiveStatus
  /** Ex: "01/06/2026 – 17/06/2026" */
  period: string
  /** 0–1 para barra de progresso de rotação */
  progress: number
}

/**
 * Cabeçalho do Modo Painel fullscreen.
 * aria-live="polite" no nome da equipe para anunciar troca ao leitor de tela.
 * Barra de progresso posicionada na base do header, largura proporcional ao progress.
 */
export function PanelHeader({
  teamName,
  liveStatus,
  period,
  progress,
}: PanelHeaderProps) {
  return (
    <header className="relative flex items-center justify-between px-6 py-4 border-b border-border bg-card shrink-0">
      <div className="flex items-center gap-4">
        {/* Nome da equipe em destaque — aria-live anuncia troca para leitores de tela */}
        <h1
          aria-live="polite"
          className="font-bold text-foreground"
          style={{ fontSize: 'clamp(24px, 3vw, 38px)' }}
        >
          {teamName}
        </h1>
        <LiveIndicator status={liveStatus} />
      </div>

      {/* Período */}
      <p className="text-sm text-muted">{period}</p>

      {/* Barra de progresso: faixa horizontal fina na base do header */}
      <div
        aria-hidden="true"
        className="absolute bottom-0 left-0 h-1 bg-primary transition-[width] duration-300 ease-linear"
        style={{ width: `${Math.round(progress * 100)}%` }}
      />
    </header>
  )
}
