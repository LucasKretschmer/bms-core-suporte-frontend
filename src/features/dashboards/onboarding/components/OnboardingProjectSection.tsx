/**
 * Seção de Projetos do Dashboard Onboarding.
 *
 * Exibe KPI cards de estágio/tipo de projeto e dois DonutCharts (estágio e tipo).
 * Empty state claro quando todos os campos de projetos são zero (HubSpot bloqueado).
 * Nomes de estágio/tipo são labels operacionais — nunca categorias HubSpot proibidas.
 */

import { Skeleton } from '../../../../components/ui/Skeleton'
import { ErrorState } from '../../../../components/ui/ErrorState'
import { EmptyState } from '../../../../components/ui/EmptyState'
import { KpiCard } from '../../shared/components/KpiCard'
import { KpiCardGrid } from '../../shared/components/KpiCardGrid'
import { ChartCard } from '../../shared/components/ChartCard'
import { DonutChart } from '../../shared/components/DonutChart'
import type {
  DrillParams,
  DrillSpec,
  OnboardingProjectStatsDto,
} from '../../shared/types/metrics'

type OnboardingProjectSectionProps = {
  data: OnboardingProjectStatsDto | undefined
  isLoading: boolean
  isError: boolean
  onRetry: () => void
  /**
   * Drill (016 B4): KPI/fatia de projeto clicável → tabela dos projetos do estágio/tipo.
   * R5: a linha da tabela NÃO navega (não há tela de detalhe de projeto).
   */
  onProjectDrill?: (spec: DrillSpec) => void
}

/** DrillSpec por estágio (tipo=onboarding). */
function stageDrill(
  stage: NonNullable<DrillParams['stage']>,
  title: string,
): DrillSpec {
  return { metric: 'projetos', title, params: { tipo: 'onboarding', stage } }
}

/** DrillSpec por tipo (POC/Treinamento). */
function tipoDrill(
  tipo: NonNullable<DrillParams['tipo']>,
  title: string,
): DrillSpec {
  return { metric: 'projetos', title, params: { tipo } }
}

/**
 * Verifica se todos os campos de projeto são zero (dados indisponíveis).
 * Quando verdadeiro exibe empty state em vez de cards zerados.
 */
function isProjetosVazio(p: OnboardingProjectStatsDto): boolean {
  return (
    p.totalAtivos === 0 &&
    p.iniciados === 0 &&
    p.emExecucao === 0 &&
    p.parados === 0 &&
    p.emFechamento === 0 &&
    p.concluidos === 0 &&
    p.cancelados === 0 &&
    p.pocIniciadas === 0 &&
    p.treinamentos === 0
  )
}

const intlPtBr = new Intl.NumberFormat('pt-BR')
function formatCount(v: number): string {
  return intlPtBr.format(v)
}

export function OnboardingProjectSection({
  data,
  isLoading,
  isError,
  onRetry,
  onProjectDrill,
}: OnboardingProjectSectionProps) {
  if (isLoading) {
    return (
      <section aria-label="Projetos — carregando">
        <h2 className="text-[20px] font-medium text-foreground mb-3">Projetos</h2>
        <KpiCardGrid>
          {Array.from({ length: 9 }).map((_, i) => (
            <Skeleton key={i} lines={1} height="h-20" className="rounded-card" />
          ))}
        </KpiCardGrid>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton lines={1} height="h-60" className="rounded-card" />
          <Skeleton lines={1} height="h-60" className="rounded-card" />
        </div>
      </section>
    )
  }

  if (isError) {
    return (
      <section aria-label="Projetos — erro">
        <h2 className="text-[20px] font-medium text-foreground mb-3">Projetos</h2>
        <ErrorState
          message="Não foi possível carregar os dados de projetos."
          onRetry={onRetry}
        />
      </section>
    )
  }

  if (!data) return null

  if (isProjetosVazio(data)) {
    return (
      <section aria-label="Projetos — sem dados">
        <h2 className="text-[20px] font-medium text-foreground mb-3">Projetos</h2>
        <EmptyState
          message="Nenhum dado de projeto disponível para o período. A integração com o módulo de Projetos do HubSpot está em configuração."
        />
      </section>
    )
  }

  /** Retorna onClick a partir de um DrillSpec (undefined se drill desabilitado). */
  function drillClick(spec: DrillSpec): (() => void) | undefined {
    return onProjectDrill ? () => onProjectDrill(spec) : undefined
  }

  // Dados para DonutChart de estágio (apenas valores > 0 — Recharts exclui fatias zero).
  // `drill` carrega o DrillSpec de cada fatia (clique no donut → tabela do estágio).
  const estagioData = [
    { name: 'Iniciado', value: data.iniciados, drill: stageDrill('iniciados', 'Projetos iniciados no período') },
    { name: 'Em Execução', value: data.emExecucao, drill: stageDrill('execucao', 'Projetos em execução') },
    { name: 'Parado', value: data.parados, drill: stageDrill('parado', 'Projetos parados') },
    { name: 'Em Fechamento', value: data.emFechamento, drill: stageDrill('fechamento', 'Projetos em fechamento') },
    { name: 'Concluído', value: data.concluidos, drill: stageDrill('concluido', 'Projetos concluídos no período') },
    { name: 'Cancelado', value: data.cancelados, drill: stageDrill('cancelado', 'Projetos cancelados no período') },
  ].filter((item) => item.value > 0)

  // Dados para DonutChart de tipo (iniciados no período)
  const tipoData = [
    {
      name: 'Onboarding',
      value: data.iniciados - data.pocIniciadas - data.treinamentos > 0 ? data.iniciados - data.pocIniciadas - data.treinamentos : 0,
      drill: stageDrill('iniciados', 'Projetos de onboarding iniciados'),
    },
    { name: 'POC', value: data.pocIniciadas, drill: tipoDrill('poc', 'POCs iniciadas no período') },
    { name: 'Treinamento', value: data.treinamentos, drill: tipoDrill('treinamento', 'Treinamentos iniciados no período') },
  ].filter((item) => item.value > 0)

  const estagioEmpty = estagioData.length === 0
  const tipoEmpty = tipoData.length === 0

  return (
    <section aria-labelledby="section-projetos-title">
      <h2
        id="section-projetos-title"
        className="text-[20px] font-medium text-foreground mb-3"
      >
        Projetos
      </h2>

      {/* KPI Cards — estágio */}
      <KpiCardGrid className="mb-4">
        {/* Total ativos é composto (vários estágios) — sem drill de um conjunto único. */}
        <KpiCard
          label="Total ativos"
          value={data.totalAtivos}
          formatter={formatCount}
          tooltipText="Projetos com estágio ativo (excluindo Concluído e Cancelado)"
        />
        <KpiCard
          label="Iniciados no período"
          value={data.iniciados}
          formatter={formatCount}
          onClick={drillClick(stageDrill('iniciados', 'Projetos iniciados no período'))}
        />
        <KpiCard
          label="Em execução"
          value={data.emExecucao}
          formatter={formatCount}
          onClick={drillClick(stageDrill('execucao', 'Projetos em execução'))}
        />
        <KpiCard
          label="Parados"
          value={data.parados}
          formatter={formatCount}
          onClick={drillClick(stageDrill('parado', 'Projetos parados'))}
        />
        <KpiCard
          label="Em fechamento"
          value={data.emFechamento}
          formatter={formatCount}
          onClick={drillClick(stageDrill('fechamento', 'Projetos em fechamento'))}
        />
        <KpiCard
          label="Concluídos no período"
          value={data.concluidos}
          formatter={formatCount}
          onClick={drillClick(stageDrill('concluido', 'Projetos concluídos no período'))}
        />
        <KpiCard
          label="Cancelados no período"
          value={data.cancelados}
          formatter={formatCount}
          onClick={drillClick(stageDrill('cancelado', 'Projetos cancelados no período'))}
        />
        <KpiCard
          label="POC iniciadas"
          value={data.pocIniciadas}
          formatter={formatCount}
          tooltipText="Projetos do tipo POC iniciados no período"
          onClick={drillClick(tipoDrill('poc', 'POCs iniciadas no período'))}
        />
        <KpiCard
          label="Treinamentos"
          value={data.treinamentos}
          formatter={formatCount}
          tooltipText="Projetos do tipo Treinamento iniciados no período"
          onClick={drillClick(tipoDrill('treinamento', 'Treinamentos iniciados no período'))}
        />
      </KpiCardGrid>

      {/* Gráficos de donut */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChartCard
          title="Distribuição por estágio"
          isEmpty={estagioEmpty}
          emptyMessage="Nenhum projeto com estágio ativo no período."
        >
          <DonutChart
            data={estagioData}
            height={240}
            onSliceClick={
              onProjectDrill
                ? (index) => {
                    const item = estagioData[index]
                    if (item?.drill) onProjectDrill(item.drill)
                  }
                : undefined
            }
          />
        </ChartCard>

        <ChartCard
          title="Distribuição por tipo (iniciados no período)"
          isEmpty={tipoEmpty}
          emptyMessage="Nenhum projeto iniciado no período."
        >
          <DonutChart
            data={tipoData}
            height={240}
            onSliceClick={
              onProjectDrill
                ? (index) => {
                    const item = tipoData[index]
                    if (item?.drill) onProjectDrill(item.drill)
                  }
                : undefined
            }
          />
        </ChartCard>
      </div>
    </section>
  )
}
