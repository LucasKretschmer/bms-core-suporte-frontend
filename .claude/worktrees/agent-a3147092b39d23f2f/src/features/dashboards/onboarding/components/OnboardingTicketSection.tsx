/**
 * Seção de Tickets do Dashboard Onboarding.
 *
 * Exibe totais de tickets em aberto e resolvidos das equipes de Onboarding,
 * e tabela de atendidos/horas por atendente.
 */

import { Skeleton } from '../../../../components/ui/Skeleton'
import { ErrorState } from '../../../../components/ui/ErrorState'
import { EmptyState } from '../../../../components/ui/EmptyState'
import { KpiCard } from '../../shared/components/KpiCard'
import { KpiCardGrid } from '../../shared/components/KpiCardGrid'
import type { OnboardingTicketStatsDto, OnboardingAgentTicketDto } from '../../shared/types/metrics'

type OnboardingTicketSectionProps = {
  data: OnboardingTicketStatsDto | undefined
  isLoading: boolean
  isError: boolean
  onRetry: () => void
}

const intlPtBr = new Intl.NumberFormat('pt-BR')

function formatCount(v: number): string {
  return intlPtBr.format(v)
}

/** Converte segundos para string "Xh Ym" */
function formatSeconds(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  if (hours === 0) return `${minutes}m`
  if (minutes === 0) return `${hours}h`
  return `${hours}h ${minutes}m`
}

type AgentRowProps = {
  agent: OnboardingAgentTicketDto
  rank: number
}

function AgentRow({ agent, rank }: AgentRowProps) {
  return (
    <tr
      className="border-b border-border last:border-0 hover:shadow-[0_1px_3px_1px_rgba(0,0,0,0.15)] transition-shadow"
    >
      <td className="py-[9px] px-5 text-xs font-normal text-foreground text-center">
        {rank}
      </td>
      <td className="py-[9px] px-5 text-xs font-normal text-foreground">
        {agent.nome}
      </td>
      <td className="py-[9px] px-5 text-xs font-normal text-foreground text-center">
        {agent.equipe ?? '—'}
      </td>
      <td className="py-[9px] px-5 text-xs font-normal text-foreground text-center">
        {intlPtBr.format(agent.nAtendimentos)}
      </td>
      <td className="py-[9px] px-5 text-xs font-normal text-foreground text-center">
        {formatSeconds(agent.totalSegundos)}
      </td>
    </tr>
  )
}

type AgentTableProps = {
  agents: OnboardingAgentTicketDto[]
}

function AgentTable({ agents }: AgentTableProps) {
  if (agents.length === 0) {
    return (
      <EmptyState
        message="Nenhum atendimento registrado para as equipes de Onboarding no período."
        className="py-8"
      />
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse" aria-label="Atendimentos por atendente">
        <thead>
          <tr
            className="border-b border-border"
            style={{ borderRadius: '5px 5px 0 0' }}
          >
            <th
              scope="col"
              className="h-9 px-5 text-xs font-medium text-foreground text-center"
              style={{ borderWidth: '0.7px' }}
            >
              #
            </th>
            <th
              scope="col"
              className="h-9 px-5 text-xs font-medium text-foreground text-left"
              style={{ borderWidth: '0.7px' }}
            >
              Atendente
            </th>
            <th
              scope="col"
              className="h-9 px-5 text-xs font-medium text-foreground text-center"
              style={{ borderWidth: '0.7px' }}
            >
              Equipe
            </th>
            <th
              scope="col"
              className="h-9 px-5 text-xs font-medium text-foreground text-center"
              style={{ borderWidth: '0.7px' }}
            >
              Atendimentos
            </th>
            <th
              scope="col"
              className="h-9 px-5 text-xs font-medium text-foreground text-center"
              style={{ borderWidth: '0.7px' }}
            >
              Horas
            </th>
          </tr>
        </thead>
        <tbody>
          {agents.map((agent, index) => (
            <AgentRow key={agent.userId} agent={agent} rank={index + 1} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function OnboardingTicketSection({
  data,
  isLoading,
  isError,
  onRetry,
}: OnboardingTicketSectionProps) {
  if (isLoading) {
    return (
      <section aria-label="Tickets — carregando">
        <h2 className="text-[20px] font-medium text-foreground mb-3">Tickets</h2>
        <KpiCardGrid className="mb-4">
          <Skeleton lines={1} height="h-20" className="rounded-xl" />
          <Skeleton lines={1} height="h-20" className="rounded-xl" />
        </KpiCardGrid>
        <Skeleton lines={5} height="h-10" />
      </section>
    )
  }

  if (isError) {
    return (
      <section aria-label="Tickets — erro">
        <h2 className="text-[20px] font-medium text-foreground mb-3">Tickets</h2>
        <ErrorState
          message="Não foi possível carregar os dados de tickets."
          onRetry={onRetry}
        />
      </section>
    )
  }

  if (!data) return null

  return (
    <section aria-labelledby="section-tickets-title">
      <h2
        id="section-tickets-title"
        className="text-[20px] font-medium text-foreground mb-3"
      >
        Tickets
      </h2>

      {/* KPI totais */}
      <KpiCardGrid className="mb-4">
        <KpiCard
          label="Em aberto"
          value={data.emAberto}
          formatter={formatCount}
          tooltipText="Tickets com status não fechado das equipes de Onboarding"
        />
        <KpiCard
          label="Resolvidos no período"
          value={data.resolvidos}
          formatter={formatCount}
          tooltipText="Tickets fechados no período pelas equipes de Onboarding"
        />
      </KpiCardGrid>

      {/* Tabela por atendente */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="p-4 pt-3 border-b border-border">
          <h3 className="text-[16px] font-medium text-foreground">
            Atendimentos por atendente
          </h3>
        </div>
        <AgentTable agents={data.porAtendente} />
      </div>
    </section>
  )
}
