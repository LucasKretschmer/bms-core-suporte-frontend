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
import type { OnboardingProjectStatsDto } from '../../shared/types/metrics'

type OnboardingProjectSectionProps = {
  data: OnboardingProjectStatsDto | undefined
  isLoading: boolean
  isError: boolean
  onRetry: () => void
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
}: OnboardingProjectSectionProps) {
  if (isLoading) {
    return (
      <section aria-label="Projetos — carregando">
        <h2 className="text-[20px] font-medium text-foreground mb-3">Projetos</h2>
        <KpiCardGrid>
          {Array.from({ length: 9 }).map((_, i) => (
            <Skeleton key={i} lines={1} height="h-20" className="rounded-xl" />
          ))}
        </KpiCardGrid>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton lines={1} height="h-60" className="rounded-xl" />
          <Skeleton lines={1} height="h-60" className="rounded-xl" />
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

  // Dados para DonutChart de estágio (apenas valores > 0 — Recharts exclui fatias zero)
  const estagioData = [
    { name: 'Iniciado', value: data.iniciados },
    { name: 'Em Execução', value: data.emExecucao },
    { name: 'Parado', value: data.parados },
    { name: 'Em Fechamento', value: data.emFechamento },
    { name: 'Concluído', value: data.concluidos },
    { name: 'Cancelado', value: data.cancelados },
  ].filter((item) => item.value > 0)

  // Dados para DonutChart de tipo (iniciados no período)
  const tipoData = [
    { name: 'Onboarding', value: data.iniciados - data.pocIniciadas - data.treinamentos > 0 ? data.iniciados - data.pocIniciadas - data.treinamentos : 0 },
    { name: 'POC', value: data.pocIniciadas },
    { name: 'Treinamento', value: data.treinamentos },
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
        />
        <KpiCard
          label="Em execução"
          value={data.emExecucao}
          formatter={formatCount}
        />
        <KpiCard
          label="Parados"
          value={data.parados}
          formatter={formatCount}
        />
        <KpiCard
          label="Em fechamento"
          value={data.emFechamento}
          formatter={formatCount}
        />
        <KpiCard
          label="Concluídos no período"
          value={data.concluidos}
          formatter={formatCount}
        />
        <KpiCard
          label="Cancelados no período"
          value={data.cancelados}
          formatter={formatCount}
        />
        <KpiCard
          label="POC iniciadas"
          value={data.pocIniciadas}
          formatter={formatCount}
          tooltipText="Projetos do tipo POC iniciados no período"
        />
        <KpiCard
          label="Treinamentos"
          value={data.treinamentos}
          formatter={formatCount}
          tooltipText="Projetos do tipo Treinamento iniciados no período"
        />
      </KpiCardGrid>

      {/* Gráficos de donut */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChartCard
          title="Distribuição por estágio"
          isEmpty={estagioEmpty}
          emptyMessage="Nenhum projeto com estágio ativo no período."
        >
          <DonutChart data={estagioData} height={240} />
        </ChartCard>

        <ChartCard
          title="Distribuição por tipo (iniciados no período)"
          isEmpty={tipoEmpty}
          emptyMessage="Nenhum projeto iniciado no período."
        >
          <DonutChart data={tipoData} height={240} />
        </ChartCard>
      </div>
    </section>
  )
}
