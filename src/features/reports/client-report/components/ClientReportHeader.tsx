/**
 * Cabeçalho/resumo do Relatório do Cliente (U5).
 * Exibe: Cliente, Plano contratado, Competência, Apontamentos,
 * Tempo total, Plano de Suporte (horas), Faturado (horas), Não faturado (horas).
 *
 * PRIVACIDADE: nenhuma informação de categoria do HubSpot é exibida aqui.
 */

import type { ClientReportDto } from '../../shared/types/reports'
import {
  formatClientName,
  formatMonth,
  formatSeconds,
} from '../../shared/utils/formatters'

type ClientReportHeaderProps = {
  report: ClientReportDto
}

type KpiCardProps = {
  label: string
  value: string
  subtle?: boolean
}

function KpiCard({ label, value, subtle }: KpiCardProps) {
  return (
    <div className="flex flex-col gap-0.5 px-4 py-3 bg-background rounded-[5px] border border-border min-w-[120px]">
      <span className="text-xs text-foreground/60 font-normal">{label}</span>
      <span
        className={
          subtle
            ? 'text-sm font-medium text-foreground/70'
            : 'text-sm font-semibold text-foreground'
        }
      >
        {value}
      </span>
    </div>
  )
}

export function ClientReportHeader({ report }: ClientReportHeaderProps) {
  const clientName = formatClientName(report.client)
  const planName = report.plano?.nome ?? '—'
  const competencia = formatMonth(report.competencia)

  return (
    <section
      aria-label="Resumo do relatório do cliente"
      className="mb-4 p-4 bg-card rounded-[5px] border border-border"
    >
      {/* Informações do cliente */}
      <div className="mb-3 flex flex-wrap items-center gap-x-6 gap-y-1">
        <div>
          <span className="text-xs text-foreground/60">Cliente</span>
          <p className="text-[15px] font-semibold text-foreground">{clientName}</p>
        </div>
        <div>
          <span className="text-xs text-foreground/60">Plano contratado</span>
          <p className="text-sm font-medium text-foreground">{planName}</p>
        </div>
        <div>
          <span className="text-xs text-foreground/60">Competência</span>
          <p className="text-sm font-medium text-foreground">{competencia}</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="flex flex-wrap gap-3">
        <KpiCard
          label="Apontamentos"
          value={String(report.totalApontamentos)}
        />
        <KpiCard
          label="Tempo total"
          value={formatSeconds(report.totalSegundos)}
        />
        <KpiCard
          label="Plano de Suporte"
          value={formatSeconds(report.horasPlanoSegundos)}
        />
        <KpiCard
          label="Faturado"
          value={formatSeconds(report.horasFaturadoSegundos)}
        />
        <KpiCard
          label="Não faturado"
          value={formatSeconds(report.horasNaoFaturadoSegundos)}
          subtle
        />
      </div>
    </section>
  )
}
