/**
 * Catálogo declarativo dos KPIs do Dashboard Suporte.
 * Define label visível, chave do DTO, formatter e flag toleratesNull.
 *
 * REGRA AP-SECURITY-001: nenhuma label ou tooltipText pode conter o valor literal
 * "Problema - Invoicy" ou qualquer string da lista de categorias proibidas.
 * O teste kpiCatalog.test.ts verifica isso programaticamente.
 *
 * O campo horasAnalise é KPI de "Horas de análise" — label operacional, não expõe
 * a categoria interna do HubSpot.
 */

import type { DrillSpec, MetricsOverviewDto } from '../types/metrics'
import {
  formatSeconds,
  formatHours,
  formatPercent,
  formatDecimal,
} from '../../../../features/reports/shared/utils/formatters'

export type KpiDefinition = {
  /** Chave no MetricsOverviewDto */
  key: keyof MetricsOverviewDto
  /** Label visível — NUNCA "Problema - Invoicy" ou categoria proibida */
  label: string
  /** Formatador do valor numérico */
  formatter: (v: number) => string
  /** true: value pode ser null (ex: CSAT, FCR, SLA); false: sempre número */
  toleratesNull: boolean
  /** Texto de ajuda exibido no tooltip do KpiCard (AP-FRONTEND-003) */
  tooltipText?: string
  /**
   * Drill-down do KPI (016): quando definido, o card é clicável e abre a tabela
   * dos registros que compõem o número (GET /metrics/rows?metric=...).
   * Só preenchido para KPIs da família TICKET — a família apontamento ainda não
   * tem endpoint de rows no backend (onda B1) → drill desses KPIs fica como TODO.
   */
  drill?: DrillSpec
}

/** Lista de categorias HubSpot que NUNCA devem aparecer em label/tooltip/legenda */
export const CATEGORIAS_PROIBIDAS: readonly string[] = [
  'Problema - Invoicy',
  // Expandir conforme alinhamento com backend
] as const

export const KPI_CATALOG: KpiDefinition[] = [
  {
    key: 'tempoTotalSegundos',
    label: 'Tempo total no mês',
    formatter: formatSeconds,
    toleratesNull: false,
  },
  {
    key: 'ahtSegundos',
    label: 'TMA (Tempo Médio de Atendimento)',
    formatter: formatSeconds,
    toleratesNull: true,
  },
  {
    key: 'tempoMedioPausaSegundos',
    label: 'Tempo médio em pausa',
    formatter: formatSeconds,
    toleratesNull: true,
  },
  {
    key: 'mediaPausasPorAtendimento',
    label: 'Média de interrupções / atend.',
    formatter: formatDecimal,
    toleratesNull: true,
  },
  {
    key: 'backlog',
    label: 'Backlog (em aberto)',
    formatter: (v) => new Intl.NumberFormat('pt-BR').format(v),
    toleratesNull: false,
    drill: { metric: 'tickets-backlog', title: 'Backlog — tickets em aberto' },
  },
  {
    key: 'ticketsAbertos',
    label: 'Tickets abertos no período',
    formatter: (v) => new Intl.NumberFormat('pt-BR').format(v),
    toleratesNull: false,
    drill: { metric: 'tickets-abertos', title: 'Tickets abertos no período' },
  },
  {
    key: 'ticketsResolvidos',
    label: 'Tickets resolvidos no período',
    formatter: (v) => new Intl.NumberFormat('pt-BR').format(v),
    toleratesNull: false,
    drill: { metric: 'tickets-resolvidos', title: 'Tickets resolvidos no período' },
  },
  {
    key: 'taxaResolucao',
    label: 'Taxa de resolução',
    formatter: formatPercent,
    toleratesNull: true,
    // Numerador da taxa = tickets resolvidos no período.
    drill: { metric: 'tickets-resolvidos', title: 'Tickets resolvidos no período' },
  },
  {
    key: 'tmrHorasCorridas',
    label: 'TMR (corridas)',
    formatter: formatHours,
    toleratesNull: true,
    drill: { metric: 'tickets-tempos', title: 'Tickets com tempos de atendimento' },
  },
  {
    key: 'tmrHorasUteis',
    label: 'TMR (horas úteis)',
    formatter: formatHours,
    toleratesNull: true,
    drill: { metric: 'tickets-tempos', title: 'Tickets com tempos de atendimento' },
  },
  {
    key: 'tmeHorasCorridas',
    label: 'TME / 1ª resposta (corridas)',
    formatter: formatHours,
    toleratesNull: true,
    drill: { metric: 'tickets-tempos', title: 'Tickets com tempos de atendimento' },
  },
  {
    key: 'tmeHorasUteis',
    label: '1ª resposta (horas úteis)',
    formatter: formatHours,
    toleratesNull: true,
    drill: { metric: 'tickets-tempos', title: 'Tickets com tempos de atendimento' },
  },
  {
    key: 'respondidosNoPrazo',
    label: 'Respondidos no prazo (SLA)',
    formatter: (v) => new Intl.NumberFormat('pt-BR').format(v),
    toleratesNull: true,
    tooltipText: 'Requer SLA configurado no Service Hub',
    drill: {
      metric: 'tickets-sla',
      title: 'Respondidos no prazo (SLA)',
      params: { sla: 'on' },
    },
  },
  {
    key: 'respondidosForaDoPrazo',
    label: 'Respondidos fora do prazo',
    formatter: (v) => new Intl.NumberFormat('pt-BR').format(v),
    toleratesNull: true,
    drill: {
      metric: 'tickets-sla',
      title: 'Respondidos fora do prazo',
      params: { sla: 'late' },
    },
  },
  {
    key: 'ticketsReabertos',
    label: 'Tickets reabertos',
    formatter: (v) => new Intl.NumberFormat('pt-BR').format(v),
    toleratesNull: true,
    // Exemplo-âncora do PRD (016).
    drill: { metric: 'tickets-reabertos', title: 'Tickets reabertos' },
  },
  {
    key: 'csat',
    label: 'CSAT',
    formatter: formatDecimal,
    toleratesNull: true,
    tooltipText: 'Requer Service Hub configurado',
    drill: { metric: 'tickets-csat', title: 'Tickets com CSAT respondido' },
  },
  {
    key: 'fcr',
    label: 'FCR (1º contato)',
    formatter: formatPercent,
    toleratesNull: true,
    tooltipText: 'Requer hs_is_one_touch_ticket configurado',
    drill: { metric: 'tickets-fcr', title: 'Tickets — resolução no 1º contato (FCR)' },
  },
  {
    key: 'horasPlantao',
    label: 'Horas de plantão',
    formatter: formatSeconds,
    toleratesNull: false,
  },
  {
    key: 'horasPlano',
    label: 'Atendimento no plano',
    formatter: formatSeconds,
    toleratesNull: false,
  },
  {
    key: 'horasFaturadoPorFora',
    label: 'Consultoria / faturável por fora',
    formatter: formatSeconds,
    toleratesNull: false,
  },
  {
    key: 'horasAnalise',
    label: 'Horas de análise',
    formatter: formatSeconds,
    toleratesNull: false,
    tooltipText: 'Apontamentos classificados como análise interna de produto',
  },
]
