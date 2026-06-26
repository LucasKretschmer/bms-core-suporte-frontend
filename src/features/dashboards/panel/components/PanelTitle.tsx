/**
 * Título do Modo Painel — equivalente ao `.dtitle` do protótipo.
 *
 * Diferente do antigo PanelHeader (fixo), este bloco vive DENTRO do conteúdo
 * rolável: é o primeiro bloco do painel e rola junto com a página (fidelidade
 * ao protótipo, item f da arquitetura 014). Mostra:
 * - nome da equipe em destaque (`clamp(24px,3vw,38px)`), NUNCA hardcoded;
 * - o escopo (ex.: "Suporte · 01/06/2026 – 17/06/2026");
 * - o indicador "ao vivo" (LiveIndicator).
 */

import { LiveIndicator } from '../../shared/components/LiveIndicator'

type LiveStatus = 'connecting' | 'open' | 'error' | 'closed'

type PanelTitleProps = {
  /** Nome da equipe corrente — vem de TeamDto.nome ou derivado do scope. */
  teamName: string
  /** Rótulo de escopo/período (ex.: "Suporte · 01/06/2026 – 17/06/2026"). */
  scopeLabel: string
  liveStatus: LiveStatus
}

export function PanelTitle({ teamName, scopeLabel, liveStatus }: PanelTitleProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 mb-4">
      {/* Nome da equipe em destaque — aria-live anuncia a troca a leitores de tela. */}
      <h1
        aria-live="polite"
        className="font-bold leading-tight text-foreground"
        style={{ fontSize: 'clamp(24px, 3vw, 38px)' }}
      >
        {teamName}
      </h1>
      <span className="rounded-full bg-muted/15 px-2.5 py-0.5 text-sm text-muted">
        {scopeLabel}
      </span>
      <LiveIndicator status={liveStatus} />
    </div>
  )
}
