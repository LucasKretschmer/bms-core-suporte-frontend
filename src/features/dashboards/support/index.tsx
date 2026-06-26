/**
 * Dashboard Suporte — página principal.
 * Monta os slots de seção (KPIs, Movimentação, Status, Categoria, SLA, Saúde Planos).
 * Controla estado de filtros, drill-down e painel.
 *
 * Anti-conflito: somente features/dashboards/support/ é editado por este DEV.
 * shared/, rotas, routeTree e Sidebar não são tocados.
 */

import { useRef, useState } from 'react'
import { format, startOfMonth } from 'date-fns'
import { useQuery } from '@tanstack/react-query'
import { usePermissions } from '../../../hooks/usePermissions'
import { ErrorState } from '../../../components/ui/ErrorState'
import { DashboardFilters } from '../shared/components/DashboardFilters'
import { DrillDownModal } from '../shared/components/DrillDownModal'
import { TicketDrillModal } from '../shared/components/TicketDrillModal'
import { useMetricsOverview } from '../shared/hooks/useMetricsOverview'
import { useDrillDownRows } from '../shared/hooks/useDrillDownRows'
import { useTicketDrill } from '../shared/hooks/useTicketDrill'
import { useMetricsStream } from '../shared/hooks/useMetricsStream'
import { listTeams } from '../../reports/shared/services/reportsService'
import type { DrillSpec, MetricsScope, TeamDto } from '../shared/types/metrics'
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
  // date-fns format (hora local) — evita off-by-one de timezone do toISOString (UTC).
  const [from, setFrom] = useState<string | null>(
    format(startOfMonth(new Date()), 'yyyy-MM-dd'),
  )
  const [to, setTo] = useState<string | null>(format(new Date(), 'yyyy-MM-dd'))
  const [clientId, setClientId] = useState<string | null>(null)
  const [planId, setPlanId] = useState<string | null>(null)
  const [drillDownOpen, setDrillDownOpen] = useState(false)
  // Drill paramétrico da família ticket (016): KPI/fatia clicada → tabela dos registros.
  const [activeDrill, setActiveDrill] = useState<DrillSpec | null>(null)
  const [panelActive, setPanelActive] = useState(false)
  // Tempo por tela no Modo Painel (segundos, clamp 4–180, default 12 — espelha o protótipo).
  const [panelSeconds, setPanelSeconds] = useState(12)

  // Ref para devolver o foco ao botão Apresentar ao sair do painel (acessibilidade)
  const apresentarButtonRef = useRef<HTMLButtonElement | null>(null)

  // Todas as equipes vindas do backend (incl. equipes sincronizadas com gerencia=null).
  // listTeams() retorna reports.ts#TeamDto, estruturalmente compatível com metrics.ts#TeamDto.
  const { data: allTeams, isLoading: isTeamsLoading } = useQuery<TeamDto[]>({
    queryKey: ['teams'],
    queryFn: async () => {
      const teams = await listTeams()
      return teams.map((t) => ({ id: t.id, nome: t.nome, gerencia: t.gerencia ?? null }))
    },
    staleTime: 5 * 60 * 1000,
  })

  // Sem filtro por gerência: todas as equipes aparecem no combobox do Dashboard (#6).
  const teams: TeamDto[] = allTeams ?? []

  // Lista de ROTAÇÃO do painel: Global (sentinel id=0) + equipes de SUPORTE,
  // EXCLUINDO Integração e Customer Success (equipes de Onboarding).
  // Espelha `SUPPORT_TEAMS = TEAMS.filter(t => !ONBOARDING_TEAMS.includes(t.name))` do protótipo.
  // Fallback por nome cobre equipes sincronizadas com gerencia=null.
  const ONBOARDING_TEAM_NAMES = ['Integração', 'Customer Success']
  const supportTeams = teams.filter(
    (t) =>
      t.gerencia !== 'onboarding' && !ONBOARDING_TEAM_NAMES.includes(t.nome),
  )
  const panelTeams: TeamDto[] = [
    { id: 0, nome: 'Global', gerencia: null },
    ...supportTeams,
  ]

  // Índice inicial da rotação = posição do scope ATUAL na lista (espelha S._pi).
  // Global ('management:suporte'/'global') → índice 0. team:{id} → posição correspondente.
  const panelInitialIndex = (() => {
    if (scope.startsWith('team:')) {
      const teamId = scope.slice(5)
      const idx = panelTeams.findIndex((t) => String(t.id) === teamId)
      return idx >= 0 ? idx : 0
    }
    return 0
  })()

  // Hook de métricas overview (para passar SLA para SupportSlaSection)
  const overviewQuery = useMetricsOverview({
    scope,
    from,
    to,
    clientId,
    supportPlanId: planId,
  })

  // Hook de drill-down de apontamentos (legado — overview?format=rows)
  const drillDown = useDrillDownRows({ scope, from, to, clientId, supportPlanId: planId })

  // Hook de drill-down paramétrico da família ticket (016)
  // supportPlanId NÃO é repassado: /metrics/rows (família ticket) não aceita filtro de plano.
  const ticketDrill = useTicketDrill(activeDrill, { scope, from, to, clientId })

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
      {/* KPIs — Fase 1A. Drill da família ticket (016) habilitado fora do painel. */}
      <SupportKpiSection
        scope={scope}
        from={from}
        to={to}
        clientId={clientId}
        planId={planId}
        onDrillDown={panelActive ? undefined : () => setDrillDownOpen(true)}
        onTicketDrill={panelActive ? undefined : setActiveDrill}
      />

      {/* Movimentação Diária — Fase 1A */}
      {/* TODO 016/021: drill da linha de movimentação depende do snapshot diário (021) */}
      <SupportMovimentacaoSection
        scope={scope}
        from={from}
        to={to}
        clientId={clientId}
        planId={planId}
      />

      {/* Status em Aberto — Fase 1A */}
      {/* TODO 016: drill de status (fatia → tickets do status) via statusKey após merge da 020 */}
      <SupportStatusSection
        scope={scope}
        from={from}
        to={to}
        clientId={clientId}
        planId={planId}
      />

      {/* Chamados por Categoria — Fase 1B */}
      {/* TODO 016: drill por categoria depende da família apontamento no /metrics/rows (onda B1) */}
      <SupportCategorySection
        scope={scope}
        from={from}
        to={to}
        clientId={clientId}
        planId={planId}
      />

      {/* 1ª Resposta vs SLA — Fase 1B (dados vêm do overview). Fatia clicável (016). */}
      <SupportSlaSection
        respondidosNoPrazo={overviewQuery.data?.respondidosNoPrazo ?? null}
        respondidosForaDoPrazo={overviewQuery.data?.respondidosForaDoPrazo ?? null}
        isLoading={overviewQuery.isLoading}
        isError={overviewQuery.isError}
        onRetry={overviewQuery.refetch}
        onSegmentDrill={panelActive ? undefined : setActiveDrill}
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
          teams={teams}
          selectedScope={scope}
          onScopeChange={setScope}
          isTeamsLoading={isTeamsLoading}
          clientId={clientId}
          onClientChange={setClientId}
          supportPlanId={planId}
          onPlanChange={setPlanId}
          showPresentar
          onPresentar={() => setPanelActive(true)}
          panelSeconds={panelSeconds}
          onPanelSecondsChange={setPanelSeconds}
          apresentarButtonRef={apresentarButtonRef}
        />
      )}

      {/* Seções normais (visíveis quando o painel não está ativo) */}
      {!panelActive && dashboardSections}

      {/* Drill-down de apontamentos (legado) — apenas fora do modo painel */}
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

      {/* Drill-down paramétrico da família ticket (016) — KPI/fatia → tabela → ticket-detail.
          Montado apenas quando há um drill ativo (fora do painel). */}
      {!panelActive && activeDrill && (
        <TicketDrillModal
          activeDrill={activeDrill}
          onClose={() => setActiveDrill(null)}
          drill={ticketDrill}
          baseParams={{ scope, from, to, clientId }}
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
          intervalMs={panelSeconds * 1000}
          initialIndex={panelInitialIndex}
          scopeLabel="Suporte"
          liveStatus={stream.status}
        >
          {dashboardSections}
        </PanelMode>
      )}
    </div>
  )
}
