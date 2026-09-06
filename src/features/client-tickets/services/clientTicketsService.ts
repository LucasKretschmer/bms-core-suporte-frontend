import { api } from '../../../services/api'
import type { ApiResponse, PaginatedResponse } from '../../../types/api'
import type { TicketScope } from '../../../utils/reportScope'
import type {
  PlanConsumptionItemDto,
  TicketReportItemDto,
} from '../../reports/shared/types/reports'

/**
 * Serviços da feature "Tickets do cliente" (F2).
 * Desempacotam o envelope aqui — nunca no componente (R6).
 *
 * - listClientTickets → GET /api/v1/reports/tickets?clientId= (PaginatedResponse cru, B1)
 * - getClientKpis     → GET /api/v1/metrics/plan-consumption (PaginatedResponse cru),
 *                       localizando a linha do cliente pelo clientId, **no período
 *                       informado** (from/to — 121/C1).
 * - listTicketOwners  → GET /api/v1/reports/tickets/owners (opções do filtro de atendente, 070)
 */

export type ListClientTicketsParams = {
  clientId: number
  /** Default 'all': drill-down é CoordenadorPlus e deve listar TODOS os tickets do cliente. */
  scope?: TicketScope
  search?: string
  status?: string[]
  /** Filtro multi-equipe (array de IDs de equipe). */
  teamId?: number[]
  /** Filtro multi-atendente (array de IDs de usuário/owner interno) — 070. */
  owner?: number[]
  /**
   * Início do período (YYYY-MM-DD) — mesmo formato de listPlanConsumption/reportsService.
   * O backend (GET /api/v1/reports/tickets) já aceita from/to (DateTime?); afeta
   * totalSeconds/apontamentosCount. Vazio/undefined → cleanParams remove (sem filtro).
   */
  from?: string
  /** Fim do período (YYYY-MM-DD). Ver observação em `from`. */
  to?: string
  /**
   * 123/FAT-1 — `apenasFatura` de `GET /reports/tickets`
   * (`ReportsController.cs:254`, `[FromQuery] bool apenasFatura = false`).
   *
   * `true`  → o backend recorta as LINHAS por `Ticket.FechadoEm ∈ [from, to)`
   *           (`ReportQueryRepository.cs:1032-1036`), aplicado ANTES do `CountAsync`, de
   *           modo que `totalCount`/paginação acompanham o recorte.
   * `false`/ausente → nenhum recorte de linha por data: o chamado aparece sempre e só os
   *           números da linha mudam (`:1023-1025`). É o DEFAULT e é o comportamento pedido
   *           pelo usuário no documento de QA da 121 (a lista mostra os atendimentos ainda
   *           em aberto, de propósito).
   *
   * Enviado apenas quando `true` (ver o call site): mandar `apenasFatura=false` seria um
   * parâmetro a mais no wire para o mesmo efeito do default.
   */
  apenasFatura?: boolean
  sortBy?: string | null
  sortDirection?: 'asc' | 'desc'
  page: number
  pageSize: number
}

export async function listClientTickets(
  params: ListClientTicketsParams,
): Promise<PaginatedResponse<TicketReportItemDto>> {
  // Sem scope explícito o backend assume 'mine' (só tickets do owner logado).
  // Aqui forçamos 'all' por default — a tela é CoordenadorPlus e o drill-down
  // precisa de TODOS os chamados do cliente, independente de owner/TimeEntry.
  const { scope = 'all', ...rest } = params
  const { data } = await api.get<PaginatedResponse<TicketReportItemDto>>(
    '/api/v1/reports/tickets',
    { params: cleanParams({ scope, ...rest }) },
  )
  return data
}

/**
 * Opção legível de atendente (owner) para o filtro multi-select (070).
 * value = id interno do usuário (enviado em owner[]); label = nome de exibição.
 */
export type TicketOwnerOption = {
  value: number
  label: string
}

/**
 * Opções de atendente (owner) do filtro de chamados do cliente (070).
 * Envelope ApiResponse<{ value; label }[]> (mesmo padrão de /reports/tickets/statuses).
 */
export async function listTicketOwners(): Promise<TicketOwnerOption[]> {
  const { data } = await api.get<ApiResponse<TicketOwnerOption[]>>(
    '/api/v1/reports/tickets/owners',
  )
  return data.data
}

/**
 * Período (YYYY-MM-DD) usado no recorte dos KPIs de consumo — 121/C1.
 *
 * Os DOIS ramos são explícitos (AP-FRONTEND-021: "ausente" ≠ "vazio"):
 *  - `string` → vai como `from`/`to` na query e recorta a janela do consumo
 *    (`MetricsService.ResolvePeriod` → `ReportQueryRepository.GetPlanConsumptionAsync`);
 *  - `null` → o param é OMITIDO (cleanParams) e o backend aplica o default
 *    "mês corrente" (`FusoSaoPaulo.Resolver`: dia 1 → último dia do mês local). Nunca
 *    enviar string vazia: `DateTime?` no controller rejeitaria com 400.
 *
 * ⚠️ 123/FE-PER (D-2) — o painel do detalhe do parceiro **não usa mais o ramo `null`**: ele
 * resolve o mês atual em `reports/shared/utils/periodoPadrao.ts` e manda as duas datas
 * explícitas, porque a rota irmã da mesma tela (`/reports/tickets`) trata limite ausente
 * como "sem restrição", não como mês corrente. O ramo `null` continua no TIPO de propósito:
 * ele é o que obriga qualquer call site novo a decidir, em vez de herdar um default calado.
 *
 * ⚠️ 123/FAT-1 — POR QUAL DATA o período recorta, medido no código em 04/09/2026
 * (prefixo `Suporte.Infrastructure/Repositories/`). O texto anterior deste comentário
 * afirmava que `te.InicioEm >= from && te.InicioEm < toExclusive` entrava em TODOS os
 * agregados. **Isso é falso desde a demanda 121** (commit `462d092`), e um comentário
 * errado aqui é pior que nenhum: quem o lê "conserta" o backend de volta.
 *
 * O que `GetPlanConsumptionAsync` faz hoje, agregado por agregado:
 *  | agregado                     | parcela TICKET                | parcela PROJETO       |
 *  |------------------------------|-------------------------------|-----------------------|
 *  | `horasUsadas`                | `Ticket.FechadoEm` (`:759-763`) | `InicioEm` (`:769`)  |
 *  | `horasFaturaveis`            | `Ticket.FechadoEm` (`:775-779`) | `InicioEm` (`:786`)  |
 *  | `horasAnalise`               | `Ticket.FechadoEm` (`:793-798`) | — (ticket-only)      |
 *  | elegibilidade da linha       | `Ticket.FechadoEm` (`:686-689`) | `InicioEm` (`:690-692`) |
 *  | `horasEmAbertoNaoFaturadas`  | **nenhuma data** — estoque all-time, `FechadoEm == null` (`:816-824`) |
 *
 * `horasRestantes` e `horasAdicionais` não têm predicado próprio: derivam de `horasUsadas`
 * e herdam o recorte dela. A troca `InicioEm → FechadoEm` é **substituição, não conjunção**
 * (`:101-113`), e é a regra do Bloco C do PRD da 123: a hora entra na fatura da competência
 * em que o CHAMADO foi concluído. Projeto não tem chamado, logo continua por `InicioEm`
 * (decisão D2 da 121).
 */
export type ClientKpisPeriod = {
  from: string | null
  to: string | null
}

/**
 * Busca os KPIs (consumo de plano) do cliente **no período informado**.
 *
 * O endpoint plan-consumption não filtra por clientId (B1 só adicionou clientId a
 * /reports/tickets), então paginamos a lista e localizamos a linha do cliente.
 * Retorna `null` se o cliente não tiver plano/linha no relatório daquele período.
 *
 * 121/C1: antes esta função só mandava paginação, então o card do topo mostrava
 * SEMPRE o mês corrente (default do backend), ignorando o filtro da tela. O período
 * é obrigatório na assinatura justamente para que todo call site decida o ramo.
 */
export async function getClientKpis(
  clientId: number,
  period: ClientKpisPeriod,
): Promise<PlanConsumptionItemDto | null> {
  const PAGE_SIZE = 200
  let page = 1

  for (;;) {
    const { data } = await api.get<PaginatedResponse<PlanConsumptionItemDto>>(
      '/api/v1/metrics/plan-consumption',
      {
        // O período acompanha TODAS as páginas — se saísse só na primeira, a linha
        // encontrada adiante viria de outra janela.
        params: cleanParams({
          page,
          pageSize: PAGE_SIZE,
          from: period.from,
          to: period.to,
        }),
      },
    )
    const match = data.items.find((item) => item.clientId === clientId)
    if (match) return match
    if (page >= data.totalPages) return null
    page++
  }
}

function cleanParams(params: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== null && v !== undefined && v !== ''),
  )
}
