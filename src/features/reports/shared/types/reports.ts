/**
 * Tipos dos DTOs de relatórios — mapeados exatamente do backend.
 * Nunca usar 'any'. Nunca duplicar tipos do backend.
 */

// ── Comuns ──────────────────────────────────────────────────────────────────

export type RequesterDto = {
  nome: string | null
  email: string | null
}

// ── Configuração ─────────────────────────────────────────────────────────────

export type SupportPlanDto = {
  id: number
  nome: string
  horasMes: number
  precoHoraExtra: number | null
  moeda: string
  isActive: boolean
}

export type ClientListItemDto = {
  id: number
  hubspotCompanyId: number
  cnpj: string | null
  razaoSocial: string | null
  nomeFantasia: string | null
  planNome: string | null
}

export type ClientDetailDto = {
  id: number
  hubspotCompanyId: number
  cnpj: string | null
  razaoSocial: string | null
  nomeFantasia: string | null
  supportPlan: SupportPlanDto | null
  horasOverride: number | null
  horasEfetivas: number | null
}

export type TeamDto = {
  id: number
  nome: string
  /** Derivado de appsettings no backend; null p/ equipes sincronizadas. */
  gerencia: string | null
}

// ── U3 — Consumo de Planos ───────────────────────────────────────────────────

export type PlanConsumptionItemDto = {
  clientId: number
  cnpj: string | null
  nomeFantasia: string | null
  razaoSocial: string | null
  nomePlano: string | null
  qtdePlanoHoras: number
  horasUsadas: number
  horasRestantes: number
  horasAdicionais: number
  percentualPlano: number | null
  horasFaturaveis: number
  horasAnalise: number

  /**
   * 121/§4.5 (D2) — soma dos 3 baldes dos apontamentos `Completed` ativos de chamados
   * do cliente com `FechadoEm == null`. É um **ESTOQUE, all-time**: não reage ao filtro
   * de período (por isso a tela é obrigada a dizê-lo — §12/R12).
   *
   * OPCIONAL de propósito: o backend de §8 (FAT-3) ainda **não** expõe o campo.
   * AP-FRONTEND-021 — "ausente" ≠ "vazio", e os dois ramos são estados distintos:
   *   `undefined` → backend antigo, não sabe responder ⇒ a UI mostra "—";
   *   `0`         → backend novo dizendo "nada em aberto" ⇒ a UI mostra "0h 0m".
   * Um helper que colapse os dois (`?? 0`) afirmaria "não há trabalho em aberto"
   * durante todo o intervalo entre os dois deploys.
   * **Remover o `?` quando FAT-3 estiver em produção.**
   *
   * `| null` (121/F4): "ausente" tem DUAS formas na fronteira HTTP — chave que não veio
   * (`undefined`) e chave que veio nula (`null`, o que um `decimal?` do C# serializa).
   * O tipo declara as duas para que todo call site novo seja obrigado a decidir, e o
   * guard é `== null` — nunca `=== undefined`.
   */
  horasEmAbertoNaoFaturadas?: number | null
}

// ── U4 — Apontamentos por Ticket ─────────────────────────────────────────────

/**
 * Categoria semântica fechada do stage (whitelist do banco, 4 valores + null).
 * MELH-01 — fonte da cor do badge de Status. NUNCA derivar cor a partir do
 * texto de `status` (label livre vindo do HubSpot).
 */
export type TicketStatusCategoria = 'aberto' | 'emandamento' | 'fechado' | 'cancelado'

export type TicketReportItemDto = {
  ticketId: number
  hubspotTicketId: string
  assunto: string | null
  clienteNome: string | null
  equipe: string | null
  ownerNome: string | null
  status: string | null
  /**
   * Categoria do HubSpot (ex.: "Problema - Invoicy"). Exibida apenas na TELA
   * (coluna + filtro) desta tela interna — NUNCA no export CSV/Excel (privacidade,
   * AP-SECURITY-001/§8.3). Null quando o backend não classifica o ticket.
   */
  categoria?: string | null
  totalSeconds: number
  apontamentosCount: number
  hubspotUrl: string | null

  // ── NOVOS (aditivos, 119 — CORR-05/MELH-01/MELH-02) — sempre presentes ──────
  /**
   * CORR-05 — regra canônica: `DesativadoEm IS NULL` + `Status NOT IN (Cancelled,
   * Discarded)` (120/D-1 amplia a exclusão para incluir Discarded), SEM recorte de
   * período (distinto de `totalSeconds`, que é do período filtrado).
   */
  totalSecondsAllTime: number
  /** CORR-05 — idem, contagem de apontamentos sem recorte de período. */
  apontamentosCountAllTime: number
  /** MELH-01 — nome cru do stage, sem "(Pipeline)". Não usado nesta entrega (o texto do badge vem de `status`); mantido por paridade de contrato. */
  statusNome: string | null
  /** MELH-01 — fonte da cor do badge de Status. NUNCA derivar cor de `status` (texto). */
  statusCategoria: TicketStatusCategoria | null
  /** MELH-02 — nomes distintos das categorias do TIMER nos apontamentos da mesma janela de `totalSeconds` (período + Completed). Vazio = nenhum apontamento categorizado no período. */
  categoriasTimer: string[]

  // ── NOVOS (aditivos, 121/§4.4 — A1/D1/D2) ───────────────────────────────────
  // Todos OPCIONAIS enquanto FAT-3 não subir (o contrato de §8 está congelado, mas o
  // backend ainda não o implementa). AP-FRONTEND-021: `undefined` = o backend não sabe
  // responder; `null`/`false`/`0` = ele respondeu. Remover os `?` quando FAT-3 subir.
  /** ISO-8601 de `Ticket.FechadoEm`. `null` = chamado sem data de conclusão. */
  fechadoEm?: string | null
  /**
   * `FechadoEm != null && FechadoEm ∈ [from, toExclusive)` — calculado no backend.
   * `undefined` **ou `null`** ⇒ a coluna "Na fatura" mostra "—" (indisponível), NUNCA
   * "Não": dizer "Não" para um campo ausente afirmaria que o chamado está fora da
   * fatura. Os dois estão no tipo de propósito (121/F4): um `bool?` no DTO do C#
   * transforma um no outro sem quebrar tipo nenhum, e o guard tem de ser `== null`.
   */
  entraNaFatura?: boolean | null
  /**
   * Os 3 baldes de fatura do chamado, **ALL-TIME** (sem recorte de `InicioEm`) — §4.4.
   * Somam os apontamentos `Completed` do chamado; a competência é a data de conclusão do
   * CHAMADO (`entraNaFatura`), não a de cada apontamento.
   *
   * `?` + `| null` pelo mesmo motivo já registrado em `entraNaFatura` logo acima (121/F4):
   * hoje o backend declara `long` não-anulável com default `0`
   * (`ReportsDtos.cs:267-269`), então o número sempre vem — mas "ausente" tem DUAS formas
   * na fronteira HTTP (chave que não veio, do backend anterior a FAT-3; chave nula, que um
   * `long?` no DTO produziria sem quebrar tipo nenhum), e as duas significam
   * **desconhecido**, não zero. O tipo declara as duas para que todo call site novo seja
   * obrigado a decidir; o guard é `== null` (ver `client-tickets/columns.ts::baldeTexto`).
   * Um `?? 0` afirmaria "nenhuma hora neste balde" onde o valor é desconhecido.
   */
  faturaPlanoSegundos?: number | null
  faturaFaturadoSegundos?: number | null
  faturaAnaliseSegundos?: number | null
}

// ── 121/§5.2 (A2/D2) + F-15 — Relatório de exceções de faturamento ────────────

/**
 * F-15 (decisão do usuário, 04/08/2026) — o relatório tem **DUAS seções**, com
 * predicados diferentes e propósitos diferentes. Ambas partem de
 * `Ticket.FechadoEm == null` (o que sai da fatura desta competência por D1):
 *
 *  - `anomalia`   — estágio do chamado é FECHADO (`PipelineStage.Fechado == true`).
 *                   Defeito de sincronização: o chamado está encerrado no HubSpot e
 *                   as horas dele saem da fatura **para sempre**. **Exige ação.**
 *  - `postergado` — estágio do chamado NÃO é fechado. Chamado legitimamente aberto:
 *                   as horas entram na fatura da competência em que ele fechar.
 *                   **Informativo, não exige ação.**
 *
 * A distinção existe porque misturá-los numa lista só faz o item acionável se perder
 * no meio do informativo.
 *
 * ⚠️ Terceiro conjunto, invisível por construção: chamado cujo `pipelineStage` não
 * tem cadastro em `pipelinestages` não casa o JOIN e **não aparece em nenhuma das
 * duas seções**. Ver `naoClassificadosCount` em `BillingExceptionsSummaryDto`.
 */
export type BillingExceptionTipo = 'anomalia' | 'postergado'

/**
 * Linha do relatório — **a mesma forma nas duas seções**, de propósito: uma só
 * definição de "linha de chamado fora da fatura" não pode divergir entre as seções
 * (AP-ARQUITETURA-005). O que muda entre elas é apenas o predicado (`tipo`).
 *
 * Contrato congelado em §8 da arquitetura da demanda 121; o endpoint
 * `GET /api/v1/reports/billing-exceptions` ainda **não existe** (unidade FAT-4).
 *
 * NUNCA expõe `Ticket.Categoria`: o balde Análise é comunicado por `segundosAnalise`,
 * não pelo nome da categoria (AP-SECURITY-001).
 */
export type BillingExceptionItemDto = {
  ticketId: number
  hubspotTicketId: string
  assunto: string | null
  clientId: number | null
  /** NomeFantasia ?? RazaoSocial — mesmo coalesce do backend. */
  clienteNome: string | null
  equipe: string | null
  ownerNome: string | null
  /** Label formatada do stage, com o nome do pipeline. */
  status: string | null
  /** Nome cru do stage, sem "(Pipeline)". */
  statusNome: string | null
  /** Fonte da cor do badge de Status — nunca derivar cor do texto de `status`. */
  statusCategoria: TicketStatusCategoria | null
  /** ISO-8601; `max(InicioEm)` dos apontamentos Completed ativos. `null` = nenhum. */
  ultimaAtividadeEm: string | null
  segundosPlano: number
  segundosFaturado: number
  segundosAnalise: number
  /** Invariante do backend: == soma dos 3 baldes (não é campo independente). */
  segundosTotais: number
  hubspotUrl: string | null
}

/**
 * F-15 — agregados do relatório de exceções, **fora do envelope paginado**.
 *
 * Existe porque `PaginatedResponse<T>` só traz `totalCount`: sem este DTO, o card
 * teria de somar as horas da página recebida e chamá-las de total — um número falso
 * na tela (AP-FRONTEND-022). Aqui os três totais são exatos.
 *
 * **Partição total e mutuamente exclusiva** de `Ticket.FechadoEm == null` (é isto que
 * torna o ponto cego mensurável em vez de invisível):
 *
 * ```
 * anomaliasSegundos + postergadoSegundos + naoClassificadosSegundos
 *     == Σ horasEmAbertoNaoFaturadas (mesmo escopo de cliente/equipe) × 3600
 * ```
 *
 * Endpoint proposto (não existe ainda — requisito da unidade FAT-4):
 * `GET /api/v1/reports/billing-exceptions/summary` → `ApiResponse<T>` (recurso único,
 * não paginado — é o envelope que o repo usa nesse caso), mesmos filtros de
 * `scope/clientId/teamId/from/to` da listagem.
 */
export type BillingExceptionsSummaryDto = {
  /** Seção 1 — estágio fechado, sem data de conclusão. Exige ação. */
  anomaliasCount: number
  anomaliasSegundos: number
  /** Seção 2 — estágio não fechado, sem data de conclusão. Informativo. */
  postergadoCount: number
  postergadoSegundos: number
  /**
   * ⚠️ Falso negativo declarado: chamados cujo `pipelineStage` não tem cadastro em
   * `pipelinestages`. O JOIN não casa, então eles **não aparecem em nenhuma das duas
   * seções** — são invisíveis por construção. A tela exibe esta contagem como nota de
   * rodapé; sem ela, o buraco fica escondido.
   *
   * OPCIONAL: se o backend não expuser o campo, a tela mostra a nota **sem número**
   * (nunca `0`, que afirmaria "não há nenhum" — AP-FRONTEND-021).
   *
   * `| null` (121/F4): um `int?` do C# serializa `null`, e com guard `=== undefined` a
   * tela escreveria literalmente "null chamados não puderam ser classificados". O guard
   * é `== null`, e o tipo declara as duas formas para o compilador cobrar o ramo.
   */
  naoClassificadosCount?: number | null
  naoClassificadosSegundos?: number | null
}

/** MELH-02 — opção do filtro "Categoria do atendimento" (categoria do TIMER, interna). */
export type ServiceCategoryOptionDto = {
  id: number
  nome: string
  isActive: boolean
}

// ── Origem de apontamento (057) ───────────────────────────────────────────────

/**
 * Origem de um apontamento na visão por cliente combinada (057).
 * Discrimina linhas de ticket e de projeto na mesma listagem.
 */
export type OrigemApontamento = 'ticket' | 'projeto'

/**
 * Filtro de origem na visão por cliente combinada (057).
 * 'all' = todos (ticket + projeto); default no backend.
 */
export type OrigemFiltro = 'all' | 'ticket' | 'projeto'

// ── 057 — Apontamentos por Projeto ────────────────────────────────────────────

/**
 * Item do relatório de apontamentos por PROJETO (057).
 * Espelha o de tickets, mas project-centric: sem hubspotTicketId nem categoria HubSpot.
 * faturamento: "Faturado" | "Plano de Suporte" (projeto não tem categoria Invoicy).
 */
export type ProjectAppointmentReportItemDto = {
  timeEntryId: number
  projetoId: number
  projetoNome: string | null
  stage: string | null
  clienteNome: string | null
  equipeAtribuida: string | null
  atendente: string
  categorizacaoAtendimento: string | null
  faturamento: FaturamentoStatus
  dataApontamento: string     // ISO Z
  totalSegundos: number
}

// ── U5 — Relatório do Cliente ────────────────────────────────────────────────

/** Tipo de faturamento — conjunto fixo vindo do backend */
export type FaturamentoStatus = 'Plano de Suporte' | 'Faturado' | 'Não faturado'

/**
 * Item individual do relatório do cliente (visão combinada 057).
 * Cada linha é um apontamento de TICKET ou de PROJETO (discriminado por `origem`).
 *
 * Campos ticket-only (`ticketId`, `hubspotTicketId`, `assunto`, `aberturaDosChamado`)
 * são null quando origem = 'projeto'. Campos de projeto (`projetoId`, `projetoNome`,
 * `stage`) são null quando origem = 'ticket'.
 */
export type ClientReportItemDto = {
  timeEntryId: number
  origem: OrigemApontamento
  ticketId: number | null
  hubspotTicketId: string | null
  projetoId: number | null
  projetoNome: string | null
  stage: string | null
  assunto: string | null
  equipeAtribuida: string | null
  solicitante: RequesterDto | null
  atendente: string
  /**
   * Dono/responsável do chamado (owner do ticket) — DISTINTO do `atendente` do
   * apontamento. Vem do backend (096) como chave JSON `donoChamado` (camelCase).
   * Null para origem = 'projeto' (projeto pode não ter owner) ou quando o backend
   * local ainda não expõe o campo — nesse caso o consolidado degrada para o
   * fallback de atendentes distintos.
   */
  donoChamado?: string | null
  categorizacaoAtendimento: string | null
  /** Propriedade HubSpot 'servico' (118.5.2) — serviço vinculado ao chamado. */
  servico: string | null
  /** Propriedade HubSpot 'servico__secundario' (118.5.2). */
  servicoSecundario: string | null
  faturamento: FaturamentoStatus
  aberturaDosChamado: string | null  // ISO Z (null p/ projeto)
  dataApontamento: string            // ISO Z
  totalSegundos: number
  /**
   * 121/A1 (D1) — data de conclusão do CHAMADO da linha (`Ticket.FechadoEm`, ISO-8601).
   * Backend: `ReportsDtos.cs:51` (`ClientReportItemDto.FechadoEmChamado`), preenchido em
   * `ReportQueryRepository.cs:285` (`r.FechadoEmChamado?.ToString("o")`).
   *
   * É a **competência de fatura** da linha: as linhas de origem "ticket" deste relatório são
   * as dos chamados CONCLUÍDOS dentro do período pedido, e por isso `dataApontamento` PODE
   * estar fora do período — de propósito. Sem este campo em tela, "apontamento de 20/07" numa
   * fatura de agosto não tem explicação nenhuma na UI (123/FAT-1).
   *
   * `null`/ausente em linha de PROJETO (D2: projeto recorta por `InicioEm` e não tem chamado).
   *
   * OPCIONAL + `| null` de propósito (AP-FRONTEND-021/028): "ausente" tem DUAS formas no wire
   * — chave que não veio (o backend serializa com `DefaultIgnoreCondition =
   * WhenWritingNull`, `Program.cs:107-108`) e chave que veio nula. As duas significam
   * "sem data de conclusão", e o guard de todo call site é `== null`, nunca `=== undefined`.
   */
  fechadoEmChamado?: string | null
}

export type ClientReportDto = {
  client: ClientDetailDto
  plano: SupportPlanDto | null
  competencia: string         // YYYY-MM
  totalApontamentos: number
  totalSegundos: number
  horasPlanoSegundos: number
  horasFaturadoSegundos: number
  horasNaoFaturadoSegundos: number
  items: ClientReportItemDto[] | null
}

// ── U6 — Produtividade por Analista ─────────────────────────────────────────

export type AgentMetricDto = {
  userId: number
  nome: string
  equipe: string | null
  nAtendimentos: number
  totalSegundos: number
  ahtSegundos: number | null
  mediaPausas: number | null
}
