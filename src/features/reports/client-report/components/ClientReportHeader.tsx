/**
 * Cabeçalho/resumo do Relatório do Cliente (U5).
 * Exibe: Cliente, Plano contratado, Competência, Apontamentos,
 * Tempo total, Plano de Suporte (horas), Faturado (horas), Não faturado (horas)
 * e — só quando existe — o Crédito de Suporte da competência (132/F9).
 *
 * PRIVACIDADE: nenhuma informação de categoria do HubSpot é exibida aqui.
 *
 * ─── 132/F9 · regressão zero (PRD §5.1: "sem crédito, nada muda") ───────────────────────────
 *
 * O cartão de crédito é o ÚNICO nó novo, e ele só existe quando `temCredito`. Os dois ramos
 * sem crédito — chave ausente ("não sei") e `0` ("não há") — renderizam o DOM de sempre, sem
 * cartão, sem `<button>` de tooltip. Eles são visualmente idênticos de PROPÓSITO; quem os
 * distingue é `data-credito-conhecido` na fileira de KPIs, nunca o pixel (ver
 * `shared/utils/planoEfetivo.ts` e `utils/creditoDoRelatorio.ts`).
 *
 * ⚠️ **O cartão "Plano de Suporte" NÃO é o tamanho do plano** — é a soma das horas usadas que
 * consomem o plano (`ReportQueryRepository.cs:236`; a frase está escrita em
 * `competenciaTexts.ts:132-139`). Por isso o crédito entra como **cartão próprio**, com o
 * total em horas, e não somado dentro dele: somar crédito em horas usadas seria inventar
 * consumo. É também o que D15 pede para o artefato do cliente — o **total** de crédito, e
 * nada mais.
 */

import { clsx } from 'clsx'

import { InfoIcon } from '../../../../components/ui/InfoIcon'
import type { ClientReportDto } from '../../shared/types/reports'
import { KPI_PLANO_DE_SUPORTE_LABEL } from '../../shared/utils/competenciaTexts'
import {
  ROTULO_CREDITO_PUBLICO,
  TOOLTIP_CREDITO_PLANO,
} from '../../shared/utils/creditoTexts'
import {
  formatClientName,
  formatMonth,
  formatSeconds,
} from '../../shared/utils/formatters'
import { derivarCreditoDoRelatorio } from '../utils/creditoDoRelatorio'

type ClientReportHeaderProps = {
  report: ClientReportDto
}

type KpiCardProps = {
  label: string
  value: string
  subtle?: boolean
  /** Tooltip do ⓘ ao lado do rótulo — mesmo primitivo do `KpiCard` dos dashboards. */
  info?: string
  /**
   * Realce positivo do valor (o crédito). É **reforço**, nunca o único meio: quem comunica
   * "isto é crédito" é o rótulo textual do cartão (WCAG 1.4.1). Tire a cor e a informação
   * continua inteira.
   */
  positive?: boolean
}

function KpiCard({ label, value, subtle, info, positive }: KpiCardProps) {
  return (
    <div className="flex flex-col gap-0.5 px-4 py-3 bg-background rounded-control border border-border min-w-[120px]">
      {/* As classes de layout do ⓘ entram SÓ quando há tooltip: assim os 5 cartões que já
          existiam renderizam markup byte a byte idêntico ao de antes da 132 — regressão zero
          não é só "nenhum crédito visível", é "nenhum nó e nenhuma classe novos". */}
      <span
        className={clsx(
          'text-xs text-foreground/70 font-normal',
          info && 'flex items-center gap-1',
        )}
      >
        {label}
        {info && <InfoIcon tooltip={info} className="shrink-0" />}
      </span>
      <span
        className={
          subtle
            ? 'text-sm font-medium text-foreground/70'
            : positive
              ? 'text-sm font-semibold text-success-fg'
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
  const credito = derivarCreditoDoRelatorio(report)

  return (
    <section
      aria-label="Resumo do relatório do cliente"
      className="mb-4 p-4 bg-card rounded-control border border-border"
    >
      {/* Informações do cliente */}
      <div className="mb-3 flex flex-wrap items-center gap-x-6 gap-y-1">
        <div>
          <span className="text-xs text-foreground/70">Cliente</span>
          <p className="text-[15px] font-semibold text-foreground">{clientName}</p>
        </div>
        <div>
          <span className="text-xs text-foreground/70">Plano contratado</span>
          <p className="text-sm font-medium text-foreground">{planName}</p>
        </div>
        <div>
          <span className="text-xs text-foreground/70">Competência</span>
          <p className="text-sm font-medium text-foreground">{competencia}</p>
        </div>
      </div>

      {/* KPIs */}
      <div
        className="flex flex-wrap gap-3"
        // 132/F9 — o único discriminador entre "não sei" (ausente) e "não há" (`0`), que
        // renderizam exatamente o mesmo DOM. Sem ele, um `?? 0` no adaptador passaria em
        // todo teste visual desta tela.
        data-credito-conhecido={String(credito.creditoConhecido)}
      >
        <KpiCard
          label="Apontamentos"
          value={String(report.totalApontamentos)}
        />
        <KpiCard
          label="Tempo total"
          value={formatSeconds(report.totalSegundos)}
        />
        {/* 131: o rótulo sai da constante que `TEXTO_COMPETENCIA_PROJETO_RELATORIO_DO_CLIENTE`
            interpola — renomear o cartão reescreve a frase junto (AP-FRONTEND-022). */}
        <KpiCard
          label={KPI_PLANO_DE_SUPORTE_LABEL}
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
        {/* 132/F9 (D15) — o rótulo é a constante LOCAL `ROTULO_CREDITO_PUBLICO`; este DTO
            não traz (nem pode trazer) rótulo do wire, e o motivo interno do crédito só
            existe na tela de gerência. */}
        {credito.temCredito && (
          <KpiCard
            label={ROTULO_CREDITO_PUBLICO}
            value={credito.creditoTexto}
            info={TOOLTIP_CREDITO_PLANO}
            positive
          />
        )}
      </div>
    </section>
  )
}
