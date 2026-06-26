/**
 * Dashboard Onboarding — Fase 1C.
 *
 * Escopo fixo: gerência onboarding (sem filtro de equipe individual).
 * Filtros: período. Sem filtro de plano ou scope de equipe.
 * PanelMode: teams=[] (sem rotação, tela única com auto-scroll).
 */

import { useRef, useState } from 'react'
import { startOfMonth } from 'date-fns'
import { usePermissions } from '../../../hooks/usePermissions'
import { ErrorState } from '../../../components/ui/ErrorState'
import { DashboardFilters } from '../shared/components/DashboardFilters'
import { useMetricsStream } from '../shared/hooks/useMetricsStream'
import { useOnboardingMetrics } from './hooks/useOnboardingMetrics'
import { OnboardingProjectSection } from './components/OnboardingProjectSection'
import { OnboardingTicketSection } from './components/OnboardingTicketSection'
import { OnboardingNpsCard } from './components/OnboardingNpsCard'
import { PanelMode } from '../panel/PanelMode'

export default function DashboardOnboardingPage() {
  const { isCoordenadorOuAcima } = usePermissions()

  const [from, setFrom] = useState<string | null>(
    startOfMonth(new Date()).toISOString().slice(0, 10),
  )
  const [to, setTo] = useState<string | null>(
    new Date().toISOString().slice(0, 10),
  )
  const [panelActive, setPanelActive] = useState(false)
  // Tempo por tela no Modo Painel (segundos, clamp 4–180, default 12).
  const [panelSeconds, setPanelSeconds] = useState(12)

  // Ref para devolver o foco ao botão Apresentar ao sair do painel
  const apresentarButtonRef = useRef<HTMLButtonElement | null>(null)

  const { data, isLoading, isError, refetch } = useOnboardingMetrics({ from, to })

  // SSE — mantém o indicador "ao vivo" coerente durante a apresentação.
  const stream = useMetricsStream('management:onboarding')

  // Guarda de acesso — UX only (backend valida via 403)
  if (!isCoordenadorOuAcima) {
    return (
      <ErrorState message="Acesso restrito. Esta área é exclusiva para coordenadores e gestores." />
    )
  }

  const handleExitPanel = () => {
    setPanelActive(false)
    // Devolver foco ao botão Apresentar (acessibilidade)
    setTimeout(() => {
      apresentarButtonRef.current?.focus()
    }, 0)
  }

  const dashboardContent = (
    <>
      {/* Projetos */}
      <OnboardingProjectSection
        data={data?.projetos}
        isLoading={isLoading}
        isError={isError}
        onRetry={refetch}
      />

      {/* Tickets */}
      <OnboardingTicketSection
        data={data?.tickets}
        isLoading={isLoading}
        isError={isError}
        onRetry={refetch}
      />

      {/* NPS — placeholder fixo */}
      <OnboardingNpsCard />
    </>
  )

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-foreground">Dashboard Onboarding</h1>

      {/* Filtros — ocultos no Modo Painel */}
      {!panelActive && (
        <DashboardFilters
          from={from}
          to={to}
          onPeriodChange={(f, t) => {
            setFrom(f)
            setTo(t)
          }}
          showPresentar={isCoordenadorOuAcima}
          onPresentar={() => setPanelActive(true)}
          panelSeconds={panelSeconds}
          onPanelSecondsChange={setPanelSeconds}
          apresentarButtonRef={apresentarButtonRef}
        />
      )}

      {/* Conteúdo normal (oculto pelo PanelMode quando ativo) */}
      {!panelActive && dashboardContent}

      {/* Modo Painel — teams=[] → sem rotação, auto-scroll apenas */}
      {panelActive && (
        <PanelMode
          isActive={panelActive}
          onExit={handleExitPanel}
          teams={[]}
          scope="management:onboarding"
          onScopeChange={() => {
            // Onboarding não tem rotação — callback no-op
          }}
          from={from}
          to={to}
          intervalMs={panelSeconds * 1000}
          scopeLabel="Onboarding"
          liveStatus={stream.status}
        >
          {dashboardContent}
        </PanelMode>
      )}
    </div>
  )
}
