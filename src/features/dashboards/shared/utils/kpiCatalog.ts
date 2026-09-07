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
 *
 * ## 124/FE-TXT — tooltip que descreve a FONTE do número é código, não copy
 *
 * `AP-FRONTEND-022`: texto de UI que afirma comportamento do sistema envelhece junto com
 * o sistema. `BE-F4F5` trocou a FONTE do SLA de 1º atendimento e do FCR — os dois deixaram
 * de ser lidos de colunas do HubSpot e passaram a ser CALCULADOS a partir da configuração
 * local (plano + calendário) e do histórico de estágio. Os dois `tooltipText` que
 * mandavam o usuário ao Service Hub ficaram FALSOS no mesmo commit, e foram corrigidos
 * aqui. A evidência, no repositório do backend:
 *
 * | Fato | Onde |
 * |---|---|
 * | a ingestão grava `frsla` e `isonetouch` SEMPRE `null`, de propósito | `HubSpotClient.cs:1096` e `:1099` |
 * | as duas colunas SAÍRAM do overview; os campos saem `null` do repositório | `MetricsQueryRepository.cs:300-320` |
 * | SLA e FCR passam a vir da fonte calculada, no serviço | `MetricsService.cs:860-878` |
 * | a dependência dos tempos úteis do HubSpot foi abandonada | `decisoes.md` § `AUTO-124-12` |
 *
 * ⚠️ O `tooltipText` do **CSAT** continua VERDADEIRO e NÃO foi tocado: o CSAT segue lido
 * da propriedade do Service Hub `hs_last_csat_rating` na ingestão
 * (`HubSpotClient.cs:1054` → `:1100`), gravado em `tickets.csat` e agregado direto da
 * coluna (`MetricsQueryRepository.cs:294`). Corrigir texto correto seria regressão.
 *
 * O vocabulário ("meta de 1º atendimento", "expediente", "calendário", "histórico de
 * movimentação") é o MESMO fixado por `supportSlaStates.ts` (124/FE-F4) — dois nomes para
 * a mesma coisa confundem mais do que o texto errado.
 *
 * ## 124/P-7 — "1ª resposta" saiu daqui porque DESCREVIA ERRADO o que é medido
 *
 * Decisão do usuário (`decisoes.md` § `P-7`, 2026-09-06): o vocabulário é **"1º
 * atendimento"**, em toda a aplicação. O motivo não é consistência com as telas de
 * configuração — é que o indicador conta da abertura do chamado até o **primeiro
 * apontamento de tempo** (o atendente inicia o timer), e **não** até a primeira resposta
 * ao cliente. A ressalva está no `prd.md` §F4 e foi aceita: o número tende a ser otimista
 * frente à percepção do cliente, justamente porque o atendente pode iniciar o timer para
 * analisar antes de responder. Chamar isso de "1ª resposta" num painel de gestão promete
 * uma coisa e entrega outra.
 *
 * Pelo mesmo motivo, `respondidosNoPrazo`/`respondidosForaDoPrazo` — que são **este mesmo
 * indicador contado**, comparado com a meta — deixaram de se chamar "Respondidos" e
 * passaram a "Atendidos". As **chaves do DTO** não mudam: são o contrato de wire com
 * `MetricsOverviewDto`, e renomeá-las quebraria a leitura sem corrigir nada do que o
 * usuário lê.
 *
 * ⚠️ NÃO foi renomeado o que mede resposta de verdade: o CSAT (`Tickets com CSAT
 * respondido`, `totalRespondentes`) é preenchido pelo **cliente**, e ali "respondido" é a
 * palavra certa.
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
    // Base completa de apontamentos do período/scope (== overview.NumEntries).
    drill: { metric: 'apontamentos', title: 'Apontamentos do período' },
  },
  {
    key: 'ahtSegundos',
    label: 'TMA (Tempo Médio de Atendimento)',
    formatter: formatSeconds,
    toleratesNull: true,
    // TMA é média sobre a mesma base de apontamentos.
    drill: { metric: 'apontamentos', title: 'Apontamentos do período' },
  },
  {
    key: 'tempoMedioPausaSegundos',
    label: 'Tempo médio em pausa',
    formatter: formatSeconds,
    toleratesNull: true,
    drill: {
      metric: 'apontamentos-com-pausa',
      title: 'Apontamentos com pausa',
    },
  },
  {
    key: 'mediaPausasPorAtendimento',
    label: 'Média de interrupções / atend.',
    formatter: formatDecimal,
    toleratesNull: true,
    drill: {
      metric: 'apontamentos-com-pausa',
      title: 'Apontamentos com pausa',
    },
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
    label: 'TME / 1º atendimento (corridas)',
    formatter: formatHours,
    toleratesNull: true,
    drill: { metric: 'tickets-tempos', title: 'Tickets com tempos de atendimento' },
  },
  {
    key: 'tmeHorasUteis',
    label: '1º atendimento (horas úteis)',
    formatter: formatHours,
    toleratesNull: true,
    drill: { metric: 'tickets-tempos', title: 'Tickets com tempos de atendimento' },
  },
  {
    key: 'respondidosNoPrazo',
    // 124/P-7 — a CHAVE continua `respondidosNoPrazo` (contrato de wire); o RÓTULO não,
    // porque o que se conta é o 1º atendimento dentro da meta, não a resposta ao cliente.
    label: 'Atendidos no prazo (SLA)',
    formatter: (v) => new Intl.NumberFormat('pt-BR').format(v),
    toleratesNull: true,
    // 124/FE-TXT — era 'Requer SLA configurado no Service Hub'. A meta nunca veio do
    // Service Hub neste produto (`HubSpotClient.cs:1096` grava `FrSla: null`), e desde
    // `BE-F4F5` a apuração é local. A meta tem DUAS moradas, com precedência conferida em
    // `MetricsService.cs:691` (`PlanoSlaMinutos ?? metaDoCalendario`): dizer só "no plano"
    // mandaria preencher plano a plano quem já tem a meta padrão do calendário.
    tooltipText:
      'Requer expediente no calendário e meta de 1º atendimento no plano ou no calendário',
    drill: {
      metric: 'tickets-sla',
      title: 'Atendidos no prazo (SLA)',
      params: { sla: 'on' },
    },
  },
  {
    key: 'respondidosForaDoPrazo',
    label: 'Atendidos fora do prazo',
    formatter: (v) => new Intl.NumberFormat('pt-BR').format(v),
    toleratesNull: true,
    drill: {
      metric: 'tickets-sla',
      title: 'Atendidos fora do prazo',
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
    // 124/FE-TXT — era 'Requer hs_is_one_touch_ticket configurado'. A propriedade foi
    // ABANDONADA (`AUTO-124-12`): ela nunca retornou valor e `HubSpotClient.cs:1099`
    // grava `IsOneTouch: null`. O FCR é contado das idas ao cliente no histórico de
    // estágio do chamado (`MetricsService.ApurarFcrAsync`) — não há o que configurar.
    tooltipText: 'Calculado do histórico de movimentação do chamado',
    drill: { metric: 'tickets-fcr', title: 'Tickets — resolução no 1º contato (FCR)' },
  },
  {
    key: 'horasPlantao',
    label: 'Horas de plantão',
    formatter: formatSeconds,
    toleratesNull: false,
    drill: {
      metric: 'apontamentos',
      title: 'Apontamentos de plantão',
      params: { serviceCategory: 'Plantão' },
    },
  },
  {
    key: 'horasPlano',
    label: 'Atendimento no plano',
    formatter: formatSeconds,
    toleratesNull: false,
    drill: {
      metric: 'apontamentos',
      title: 'Atendimento no plano',
      params: { billing: 'plano' },
    },
  },
  {
    key: 'horasFaturadoPorFora',
    label: 'Consultoria / faturável por fora',
    formatter: formatSeconds,
    toleratesNull: false,
    drill: {
      metric: 'apontamentos',
      title: 'Consultoria / faturável por fora',
      params: { billing: 'fora' },
    },
  },
  {
    key: 'horasAnalise',
    label: 'Horas de análise',
    formatter: formatSeconds,
    toleratesNull: false,
    tooltipText: 'Apontamentos classificados como análise interna de produto',
    // AP-SECURITY-001: o filtro billing=analise é server-side sobre a categoria interna;
    // o título e as colunas NUNCA expõem a categoria HubSpot crua.
    drill: {
      metric: 'apontamentos',
      title: 'Horas de análise',
      params: { billing: 'analise' },
    },
  },
]
