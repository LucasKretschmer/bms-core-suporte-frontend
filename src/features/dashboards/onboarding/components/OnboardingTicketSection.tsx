/**
 * Seção de Tickets do Dashboard Onboarding.
 *
 * Exibe totais de tickets em aberto e resolvidos das equipes de Onboarding,
 * e tabela de atendidos/horas por atendente.
 *
 * Export (017 Fase D): baixa o conjunto FILTRADO já em memória (data.porAtendente),
 * sem ida extra ao backend. Só colunas visíveis — sem campos internos (AP-SECURITY-001).
 */

import { useState } from 'react'
import { Skeleton } from '../../../../components/ui/Skeleton'
import { ErrorState } from '../../../../components/ui/ErrorState'
import { EmptyState } from '../../../../components/ui/EmptyState'
import { KpiCard } from '../../shared/components/KpiCard'
import { KpiCardGrid } from '../../shared/components/KpiCardGrid'
import { ExportButtons } from '../../../reports/shared/components/ExportButtons'
import {
  exportToCsv,
  exportToXlsx,
  type ExportColumn,
  type ExportRow,
} from '../../../reports/shared/utils/exportTable'
import { useToast } from '../../../../components/ui/Toast'
import type {
  DrillSpec,
  OnboardingTicketStatsDto,
  OnboardingAgentTicketDto,
} from '../../shared/types/metrics'

type OnboardingTicketSectionProps = {
  data: OnboardingTicketStatsDto | undefined
  isLoading: boolean
  isError: boolean
  onRetry: () => void
  /** Drill (016): KPI de ticket clicável → tabela dos tickets (scope onboarding). */
  onTicketDrill?: (spec: DrillSpec) => void
  /**
   * Drill (016 B1): linha de atendente clicável → tabela dos apontamentos do atendente
   * (família apontamento, metric=apontamentos&userId=...).
   */
  onAgentDrill?: (spec: DrillSpec) => void
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

/** Colunas de export — espelham as colunas visíveis (sem campos internos). */
const EXPORT_COLUMNS: ExportColumn[] = [
  { header: '#', key: 'rank' },
  { header: 'Atendente', key: 'atendente' },
  { header: 'Equipe', key: 'equipe' },
  { header: 'Atendimentos', key: 'atendimentos' },
  { header: 'Horas', key: 'horas' },
]

function mapAgentToExportRow(agent: OnboardingAgentTicketDto, index: number): ExportRow {
  return {
    rank: index + 1,
    atendente: agent.nome,
    equipe: agent.equipe ?? '—',
    atendimentos: intlPtBr.format(agent.nAtendimentos),
    horas: formatSeconds(agent.totalSegundos),
  }
}

type AgentRowProps = {
  agent: OnboardingAgentTicketDto
  rank: number
  onClick?: () => void
}

function AgentRow({ agent, rank, onClick }: AgentRowProps) {
  const isClickable = !!onClick
  return (
    <tr
      className="border-b border-border last:border-0 hover:shadow-[0_1px_3px_1px_rgba(0,0,0,0.15)] transition-shadow"
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        isClickable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onClick?.()
              }
            }
          : undefined
      }
      style={isClickable ? { cursor: 'pointer' } : undefined}
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
  onAgentClick?: (agent: OnboardingAgentTicketDto) => void
}

function AgentTable({ agents, onAgentClick }: AgentTableProps) {
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
            <AgentRow
              key={agent.userId}
              agent={agent}
              rank={index + 1}
              onClick={onAgentClick ? () => onAgentClick(agent) : undefined}
            />
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
  onTicketDrill,
  onAgentDrill,
}: OnboardingTicketSectionProps) {
  const toast = useToast()
  const [isExporting, setIsExporting] = useState(false)

  const agents = data?.porAtendente ?? []
  const canExport = agents.length > 0

  function handleExportCsv() {
    if (isExporting) return
    setIsExporting(true)
    try {
      exportToCsv(
        'onboarding-atendimentos-por-atendente',
        EXPORT_COLUMNS,
        agents.map(mapAgentToExportRow),
      )
      toast.success('Exportação CSV concluída.')
    } catch {
      toast.error('Erro ao exportar. Tente novamente.')
    } finally {
      setIsExporting(false)
    }
  }

  async function handleExportXlsx() {
    if (isExporting) return
    setIsExporting(true)
    try {
      await exportToXlsx(
        'onboarding-atendimentos-por-atendente',
        EXPORT_COLUMNS,
        agents.map(mapAgentToExportRow),
      )
      toast.success('Exportação Excel concluída.')
    } catch {
      toast.error('Erro ao exportar. Tente novamente.')
    } finally {
      setIsExporting(false)
    }
  }

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

      {/* KPI totais — clicáveis (drill da família ticket, scope onboarding) */}
      <KpiCardGrid className="mb-4">
        <KpiCard
          label="Em aberto"
          value={data.emAberto}
          formatter={formatCount}
          tooltipText="Tickets com status não fechado das equipes de Onboarding"
          onClick={
            onTicketDrill
              ? () =>
                  onTicketDrill({
                    metric: 'tickets-backlog',
                    title: 'Tickets em aberto — Onboarding',
                  })
              : undefined
          }
        />
        <KpiCard
          label="Resolvidos no período"
          value={data.resolvidos}
          formatter={formatCount}
          tooltipText="Tickets fechados no período pelas equipes de Onboarding"
          onClick={
            onTicketDrill
              ? () =>
                  onTicketDrill({
                    metric: 'tickets-resolvidos',
                    title: 'Tickets resolvidos no período — Onboarding',
                  })
              : undefined
          }
        />
      </KpiCardGrid>

      {/* Tabela por atendente */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="flex items-center justify-between gap-3 p-4 pt-3 border-b border-border">
          <h3 className="text-[16px] font-medium text-foreground">
            Atendimentos por atendente
          </h3>
          {canExport && (
            <ExportButtons
              onExportCsv={handleExportCsv}
              onExportXlsx={() => void handleExportXlsx()}
              isExporting={isExporting}
            />
          )}
        </div>
        <AgentTable
          agents={data.porAtendente}
          onAgentClick={
            onAgentDrill
              ? (agent) =>
                  onAgentDrill({
                    metric: 'apontamentos',
                    title: `Apontamentos — ${agent.nome}`,
                    params: { userId: String(agent.userId) },
                  })
              : undefined
          }
        />
      </div>
    </section>
  )
}
