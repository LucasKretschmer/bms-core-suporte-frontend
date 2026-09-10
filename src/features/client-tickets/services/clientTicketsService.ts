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
 * ⚠️ **POR QUAL DATA o período recorta.** Este comentário é documentação VIVA e já
 * esteve errado duas vezes; um comentário errado aqui é pior que nenhum, porque quem o lê
 * "conserta" o backend de volta. Ele é reescrito por inteiro a cada troca de predicado, e
 * a medição é datada.
 *
 * 🔴 **Medido em 09/09/2026, depois da 132/B1+B2, em
 * `Suporte.Infrastructure/Repositories/ReportQueryRepository.cs`
 * (`GetPlanConsumptionAsync`).** O texto anterior dizia `Ticket.FechadoEm` em quatro das
 * cinco linhas — **é falso desde a 132/D1**, e as âncoras numéricas dele também já não
 * batiam. Ancorado agora pelos MARCADORES `⟪…⟫` do próprio arquivo, não por número de
 * linha: há trabalho de backend em voo e linha envelhece entre a leitura e o merge.
 *
 *  | agregado                | parcela TICKET                    | parcela PROJETO        |
 *  |-------------------------|-----------------------------------|------------------------|
 *  | `horasUsadas`           | `te.InicioEm` ⟪131 PLANCONSUMO-HORASUSADAS⟫ | — **ticket-only** (a ausência é requisito da 131, não esquecimento) |
 *  | `horasFaturaveis`       | `te.InicioEm` (mesmo bloco)       | `te.InicioEm`          |
 *  | `horasAnalise`          | `te.InicioEm` (mesmo bloco)       | — (ticket-only)        |
 *  | elegibilidade da linha  | `te.InicioEm` ⟪121/A1 PLANCONSUMO-ELEGIBILIDADE⟫ | `te.InicioEm` (mesmo bloco) |
 *
 * **Uma coluna de data para tudo.** A competência de faturamento de uma hora é o mês do
 * dia local São Paulo de `TimeEntry.InicioEm`, e `Ticket.FechadoEm` **não participa de
 * nenhuma decisão de fatura** — a regra canônica está escrita UMA vez, no XML-doc de
 * `PlanConsumptionItemDto` (`Application/DTOs/Reports/ReportsDtos.cs`), e é de lá que
 * este resumo deriva (`AP-ARQUITETURA-005`: segunda implementação é implementação que
 * diverge).
 *
 * `horasRestantes` e `horasAdicionais` não têm predicado próprio: derivam de `horasUsadas`
 * e herdam o recorte dela.
 *
 * 🔴 **A quinta linha desta tabela era `horasEmAbertoNaoFaturadas`** — "nenhuma data,
 * estoque all-time, `FechadoEm == null`". O campo **saiu do wire** na 132/B1+B2 e o
 * cartão que o exibia saiu de `ClientTicketsPanel.tsx` na 132/F2 (D7). O conceito não foi
 * escondido, deixou de existir: com a competência vindo do apontamento, não há hora fora
 * de fatura nenhuma esperando um chamado fechar. O que antes ficava nesse limbo aparece
 * nos agregados acima, na competência em que foi apontado.
 *
 * ⚠️ `Ticket.FechadoEm` **continua sendo PROJETADO** noutras rotas (`FechadoEmChamado`,
 * a coluna "Concluído em") — é dado operacional da linha, não a competência dela.
 * Projeção não é predicado; restaurar um predicado sobre ele faria a hora de janeiro num
 * chamado ainda ABERTO desaparecer do relatório (o defeito que a D1 revogou).
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
