/**
 * Dashboard Suporte — página principal.
 * Monta os slots de seção (KPIs, Movimentação, Status, Categoria, SLA, Saúde Planos).
 * Controla estado de filtros, drill-down e painel.
 *
 * Anti-conflito: somente features/dashboards/support/ é editado por este DEV.
 * shared/, rotas, routeTree e Sidebar não são tocados.
 */

import { useRef, useState } from 'react'
import { startOfMonth } from 'date-fns'
import { useQuery } from '@tanstack/react-query'
import { usePermissions } from '../../../hooks/usePermissions'
import { ErrorState } from '../../../components/ui/ErrorState'
import { DashboardFilters } from '../shared/components/DashboardFilters'
import { DrillDownModal } from '../shared/components/DrillDownModal'
import { useMetricsOverview } from '../shared/hooks/useMetricsOverview'
import { useDrillDownRows } from '../shared/hooks/useDrillDownRows'
import { useMetricsStream } from '../shared/hooks/useMetricsStream'
import { listTeams } from '../../reports/shared/services/reportsService'
import type { MetricsScope, TeamDto } from '../shared/types/metrics'
import { PanelMode } from '../panel/PanelMode'

// Seções implementadas
import { SupportKpiSection } from './components/SupportKpiSection'
import { SupportMovimentacaoSection } from './components/SupportMovimentacaoSection'
import { SupportStatusSection } from './components/SupportStatusSection'
import { SupportCategorySection } from './components/SupportCategorySection'
import { SupportSlaSection } from './components/SupportSlaSection'
import { SupportPlanHealthSection } from './components/SupportPlanHealthSection'

export default function DashboardSuportePage() {
  const { isCoordenadorOuAcima } = usePermissions()

  const [scope, setScope] = useState<MetricsScope>('management:suporte')
  const [from, setFrom] = useState<string | null>(
    startOfMonth(new Date()).toISOString().slice(0, 10),
  )
  const [to, setTo] = useState<string | null>(new Date().toISOString().slice(0, 10))
  const [clientId, setClientId] = useState<string | null>(null)
  const [planId, setPlanId] = useState<string | null>(null)
  const [drillDownOpen, setDrillDownOpen] = useState(false)
  const [panelActive, setPanelActive] = useState(false)

  // Ref para devolver o foco ao botão Apresentar ao sair do painel (acessibilidade)
  const apresentarButtonRef = useRef<HTMLButtonElement | null>(null)

  // Equipes filtradas por gerência suporte — vindas do backend
  const { data: allTeams, isLoading: isTeamsLoading } = useQuery<TeamDto[]>({
    queryKey: ['teams'],
    queryFn: async () => {
      const teams = await listTeams()
      return teams as TeamDto[]
    },
    staleTime: 5 * 60 * 1000,
  })

  // Filtra equipes por gerencia=suporte para o filtro do Dashboard Suporte
  const supportTeams: TeamDto[] = (allTeams ?? []).filter(
    (t) => (t as TeamDto & { gerencia?: string | null }).gerencia === 'suporte',
  )

  // Lista para o PanelMode: Global (sentinel id='') + equipes de suporte
  const panelTeams: TeamDto[] = [
    { id: '', nome: 'Global', gerencia: 'suporte' },
    ...supportTeams,
  ]

  // Hook de métricas overview (para passar SLA para SupportSlaSection)
  const overviewQuery = useMetricsOverview({
    scope,
    from,
    to,
    clientId,
    supportPlanId: planId,
  })

  // Hook de drill-down (controle centralizado)
  const drillDown = useDrillDownRows({ scope, from, to, clientId, supportPlanId: planId })

  // SSE — atualizações em tempo real
  const stream = useMetricsStream(scope)

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

  // Seções do dashboard — usadas tanto na view normal quanto dentro do PanelMode
  const dashboardSections = (
    <>
      {/* KPIs — Fase 1A */}
      <SupportKpiSection
        scope={scope}
        from={from}
        to={to}
        clientId={clientId}
        planId={planId}
        onDrillDown={panelActive ? undefined : () => setDrillDownOpen(true)}
      />

      {/* Movimentação Diária — Fase 1A */}
      <SupportMovimentacaoSection
        scope={scope}
        from={from}
        to={to}
        clientId={clientId}
        planId={planId}
      />

      {/* Status em Aberto — Fase 1A */}
      <SupportStatusSection
        scope={scope}
        from={from}
        to={to}
        clientId={clientId}
        planId={planId}
      />

      {/* Chamados por Categoria — Fase 1B */}
      <SupportCategorySection
        scope={scope}
        from={from}
        to={to}
        clientId={clientId}
        planId={planId}
      />

      {/* 1ª Resposta vs SLA — Fase 1B (dados vêm do overview) */}
      <SupportSlaSection
        respondidosNoPrazo={overviewQuery.data?.respondidosNoPrazo ?? null}
        respondidosForaDoPrazo={overviewQuery.data?.respondidosForaDoPrazo ?? null}
        isLoading={overviewQuery.isLoading}
        isError={overviewQuery.isError}
        onRetry={overviewQuery.refetch}
      />

      {/* Saúde dos Planos (sempre global) — Fase 1B */}
      <SupportPlanHealthSection
        from={from}
        to={to}
        clientId={clientId}
        planId={planId}
      />
    </>
  )

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold text-foreground">Dashboard Suporte</h1>

      {/* Barra de filtros — oculta no Modo Painel */}
      {!panelActive && (
        <DashboardFilters
          from={from}
          to={to}
          onPeriodChange={(f, t) => {
            setFrom(f)
            setTo(t)
          }}
          teams={supportTeams}
          selectedScope={scope}
          onScopeChange={setScope}
          isTeamsLoading={isTeamsLoading}
          clientId={clientId}
          onClientChange={setClientId}
          supportPlanId={planId}
          onPlanChange={setPlanId}
          showPresentar
          onPresentar={() => setPanelActive(true)}
          apresentarButtonRef={apresentarButtonRef}
        />
      )}

      {/* Seções normais (visíveis quando o painel não está ativo) */}
      {!panelActive && dashboardSections}

      {/* Drill-down modal — apenas fora do modo painel */}
      {!panelActive && (
        <DrillDownModal
          isOpen={drillDownOpen}
          onClose={() => setDrillDownOpen(false)}
          title="Detalhes de apontamentos"
          drillDown={drillDown}
          onStreamPause={stream.pause}
          onStreamResume={stream.resume}
        />
      )}

      {/* Modo Painel — overlay fullscreen com rotação de equipes */}
      {panelActive && (
        <PanelMode
          isActive={panelActive}
          onExit={handleExitPanel}
          teams={panelTeams}
          scope={scope}
          onScopeChange={setScope}
          from={from}
          to={to}
          liveStatus={stream.status}
        >
          {dashboardSections}
        </PanelMode>
      )}
    </div>
  )
}
