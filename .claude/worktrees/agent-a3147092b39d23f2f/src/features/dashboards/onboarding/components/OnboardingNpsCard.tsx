/**
 * Card NPS — placeholder fixo.
 *
 * NPS não está implementado nesta versão.
 * Sempre exibe "—" com badge "Em breve" e tooltip explicativo.
 * Sem chamada de API — sem estado loading/error.
 */

import { KpiCard } from '../../shared/components/KpiCard'

/**
 * Card de NPS sempre no estado placeholder.
 * Nunca exibe dado real — coleta de NPS não configurada.
 */
export function OnboardingNpsCard() {
  return (
    <section aria-labelledby="section-nps-title">
      <h2
        id="section-nps-title"
        className="text-[20px] font-medium text-foreground mb-3"
      >
        NPS
      </h2>
      <div className="flex items-start gap-3">
        <KpiCard
          label="NPS"
          value={null}
          subtext="Implementação futura"
          subtextVariant="neutral"
          tooltipText="Coleta de NPS não configurada nesta versão."
          className="min-w-[180px]"
        />
        <div className="flex items-center mt-1">
          <span
            className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-border/50 text-foreground/60"
            aria-label="Funcionalidade em breve"
          >
            Em breve
          </span>
        </div>
      </div>
    </section>
  )
}
