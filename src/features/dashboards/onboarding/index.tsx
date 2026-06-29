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
import { TicketDrillModal } from '../shared/components/TicketDrillModal'
import { ApontamentoDrillModal } from '../shared/components/ApontamentoDrillModal'
import { ProjectDrillModal } from '../shared/components/ProjectDrillModal'
import { useMetricsStream } from '../shared/hooks/useMetricsStream'
import { useMetricDrill } from '../shared/hooks/useMetricDrill'
import { useOnboardingMetrics } from './hooks/useOnboardingMetrics'
import { OnboardingProjectSection } from './components/OnboardingProjectSection'
import { OnboardingTicketSection } from './components/OnboardingTicketSection'
import { OnboardingNpsCard } from './components/OnboardingNpsCard'
import { PanelMode } from '../panel/PanelMode'
import { metricFamily } from '../shared/types/metrics'
import type {
  DrillSpec,
  ProjectRowDto,
  TicketRowDto,
  TimeEntryDrillRowDto,
} from '../shared/types/metrics'

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
  // Drill paramétrico da família ticket (016).
  const [activeDrill, setActiveDrill] = useState<DrillSpec | null>(null)

  // Ref para devolver o foco ao botão Apresentar ao sair do painel
  const apresentarButtonRef = useRef<HTMLButtonElement | null>(null)

  const { data, isLoading, isError, refetch } = useOnboardingMetrics({ from, to })

  // SSE — mantém o indicador "ao vivo" coerente durante a apresentação.
  const stream = useMetricsStream('management:onboarding')

  // Família do drill ativo — decide qual hook fica habilitado (os demais recebem null).
  const drillFamily = activeDrill ? metricFamily(activeDrill.metric) : null

  // Drill paramétrico (016): um hook por família, só o ativo dispara a query.
  // Ticket/apontamento herdam o scope da gerência onboarding; projeto é fixo onboarding no BE.
  const ticketDrill = useMetricDrill<TicketRowDto>(
    drillFamily === 'ticket' ? activeDrill : null,
    { scope: 'management:onboarding', from, to },
  )
  const apontamentoDrill = useMetricDrill<TimeEntryDrillRowDto>(
    drillFamily === 'apontamento' ? activeDrill : null,
    { scope: 'management:onboarding', from, to },
  )
  const projectDrill = useMetricDrill<ProjectRowDto>(
    drillFamily === 'projeto' ? activeDrill : null,
    { from, to },
  )

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
      {/* Projetos — KPIs/donuts clicáveis (016 B4, família projeto). R5: linha não navega. */}
      <OnboardingProjectSection
        data={data?.projetos}
        isLoading={isLoading}
        isError={isError}
        onRetry={refetch}
        onProjectDrill={panelActive ? undefined : setActiveDrill}
      />

      {/* Tickets — KPIs de ticket clicáveis (016) + linha de atendente → apontamentos (B1). */}
      <OnboardingTicketSection
        data={data?.tickets}
        isLoading={isLoading}
        isError={isError}
        onRetry={refetch}
        onTicketDrill={panelActive ? undefined : setActiveDrill}
        onAgentDrill={panelActive ? undefined : setActiveDrill}
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

      {/* Drill-down paramétrico (016) — o metric escolhe o modal/hook da família.
          Montado só com drill ativo (fora do painel). Cada modal pausa o SSE (PRD §6). */}
      {!panelActive && activeDrill && drillFamily === 'ticket' && (
        <TicketDrillModal
          activeDrill={activeDrill}
          onClose={() => setActiveDrill(null)}
          drill={ticketDrill}
          baseParams={{ scope: 'management:onboarding', from, to }}
          onStreamPause={stream.pause}
          onStreamResume={stream.resume}
        />
      )}

      {!panelActive && activeDrill && drillFamily === 'apontamento' && (
        <ApontamentoDrillModal
          activeDrill={activeDrill}
          onClose={() => setActiveDrill(null)}
          drill={apontamentoDrill}
          baseParams={{ scope: 'management:onboarding', from, to }}
          onStreamPause={stream.pause}
          onStreamResume={stream.resume}
        />
      )}

      {/* Projeto (R5): a linha da tabela NÃO navega (sem tela de detalhe de projeto). */}
      {!panelActive && activeDrill && drillFamily === 'projeto' && (
        <ProjectDrillModal
          activeDrill={activeDrill}
          onClose={() => setActiveDrill(null)}
          drill={projectDrill}
          baseParams={{ from, to }}
          onStreamPause={stream.pause}
          onStreamResume={stream.resume}
        />
      )}

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
