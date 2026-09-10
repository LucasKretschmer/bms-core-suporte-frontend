/**
 * Tipos dos DTOs de relatórios — mapeados exatamente do backend.
 * Nunca usar 'any'. Nunca duplicar tipos do backend.
 */

import type { PaginatedResponse } from '../../../../types/api'

// ── Comuns ──────────────────────────────────────────────────────────────────

export type RequesterDto = {
  nome?: string | null
  email?: string | null
}

// ── Configuração ─────────────────────────────────────────────────────────────

export type SupportPlanDto = {
  id: number
  nome: string
  horasMes: number
  precoHoraExtra?: number | null
  moeda: string
  isActive: boolean
}

export type ClientListItemDto = {
  id: number
  hubspotCompanyId: number
  cnpj?: string | null
  razaoSocial?: string | null
  nomeFantasia?: string | null
  planNome?: string | null
}

export type ClientDetailDto = {
  id: number
  hubspotCompanyId: number
  cnpj?: string | null
  razaoSocial?: string | null
  nomeFantasia?: string | null
  supportPlan?: SupportPlanDto | null
  horasOverride?: number | null
  horasEfetivas?: number | null
}

export type TeamDto = {
  id: number
  nome: string
  /** Derivado de appsettings no backend; null p/ equipes sincronizadas. */
  gerencia?: string | null
}

// ── U3 — Consumo de Planos ───────────────────────────────────────────────────

export type PlanConsumptionItemDto = {
  clientId: number
  /**
   * 129/FE-PCT — **dívida da FE-WIRE QUITADA.** `Cnpj` é `string?` no backend
   * (`ReportsDtos.cs:174`) e a API serializa com `DefaultIgnoreCondition =
   * WhenWritingNull` (`Program.cs:210-215`) ⇒ quando é nulo **a chave é OMITIDA do JSON,
   * não vem `null`**. Por isso `?` — e todo guard deste campo é `== null`, nunca
   * `=== null`. Ver `columns.ts::formatCnpj`.
   */
  cnpj?: string | null
  nomeFantasia?: string | null
  razaoSocial?: string | null
  nomePlano?: string | null
  qtdePlanoHoras: number
  horasUsadas: number
  horasRestantes: number
  horasAdicionais: number
  /**
   * 129/FE-PCT — `decimal?` no backend (`ReportsDtos.cs:183`) ⇒ **chave omitida** quando o
   * cliente não tem plano/percentual apurável. O `?` aqui é o que obriga cada call site a
   * decidir o ramo "desconhecido": `getPercentClass` devolvia `'red'` para `undefined`
   * (todos os `<` falham) e a tela **afirmava "estourou o plano" sobre um valor que
   * ninguém sabe**. Guard correto: `== null` ⇒ `'neutral'`.
   */
  percentualPlano?: number | null
  horasFaturaveis: number
  horasAnalise: number

  // ── 132/F4 — PLANO EFETIVO (aditivos) ──────────────────────────────────────
  //
  // 🔴 D11/D21 — a coluna "Qtde. Plano (h)" passa a exibir `15h + 2h`: o plano BASE
  // mais o crédito de horas da competência. As três derivadas (`horasRestantes`,
  // `percentualPlano`, `horasAdicionais`) JÁ chegam calculadas sobre o plano EFETIVO
  // (`ReportQueryRepository.cs:1017-1043` → `CalculadoraPlanoEfetivo`): o front NÃO
  // recalcula nenhuma delas, nem para conferir, nem para o export
  // (AP-ARQUITETURA-005 — segunda implementação é implementação que diverge).
  //
  // Os três campos são `?` **e** `| null` de propósito (AP-FRONTEND-028): no backend
  // são `decimal` não-anuláveis com default `0m` (`ReportsDtos.cs:282-284`), logo o
  // backend NOVO sempre manda a chave; o backend ANTERIOR à 132 não a manda. Os dois
  // ramos são estados distintos e todo guard é `== null`, nunca `=== undefined`:
  //   chave ausente **ou** `null` → "não sei responder" ⇒ a coluna renderiza como
  //                                  hoje: só o plano base, sem `+`, sem tooltip;
  //   `0`                         → "não há crédito"   ⇒ visualmente IDÊNTICO ao de
  //                                  cima. É a regressão zero (PRD §5.1);
  //   `> 0`                       → há crédito ⇒ `+Xh` + reforço textual + ⓘ.
  // Os dois primeiros produzem a mesma tela de PROPÓSITO — o discriminador é
  // `creditoConhecido` de `shared/utils/planoEfetivo.ts`, não o DOM.

  /**
   * Σ das horas dos créditos vigentes da competência exibida — `competencia == C`,
   * `estornadoem IS NULL`, `desativadoem IS NULL`, independente de `origem`
   * (`ReportsDtos.cs:250-258`). **HORAS**, nunca segundos.
   *
   * D20 — em período NÃO-mensal vem `0` (fail-closed, sem rateio): a tela não infla o
   * plano num recorte de 45 dias. O aviso de C-7 é que explica isso ao usuário, e ele
   * é de outra unidade (F4d).
   */
  creditoHoras?: number | null

  /**
   * `qtdePlanoHoras + creditoHoras`, exato (o backend NÃO arredonda esta ponta —
   * `ReportQueryRepository.cs:1038-1042` — porque a identidade é um CHECK do banco).
   *
   * ⚠️ **Não é a fonte do número que a tela imprime.** `derivarPlanoEfetivo` soma
   * `base + crédito` (os dois átomos que o usuário lê na célula) e usa este campo
   * apenas para DENUNCIAR divergência: o default `0m` do construtor posicional do C#
   * (`ReportsDtos.cs:283`) faria uma tela de fatura imprimir `0h` como plano efetivo
   * se ele fosse lido cru contra um backend que ainda não o preenche.
   */
  qtdePlanoEfetivoHoras?: number | null

  /**
   * Os créditos que compõem o plano efetivo, um por linha (`PlanConsumptionCreditoDto`).
   * `null`/ausente = backend anterior à 132; `[]` = backend novo dizendo "nenhum".
   */
  creditos?: PlanConsumptionCreditoDto[] | null

  // ── 135/G1 — CONTAGEM DE CHAMADOS (aditivo) ────────────────────────────────

  /**
   * 135/G1 — quantidade de chamados **ABERTOS no período filtrado**, independente do
   * status atual (PRD §2). Recorte: `Ticket.HsCriadoEm ∈ [from, toExclusive)` +
   * `DesativadoEm IS NULL` (`135/analise-backend.md` §3.1;
   * `ReportQueryRepository.cs:1172`).
   *
   * 🔴 **Recorte DIFERENTE do de todas as outras colunas da linha, de propósito** (PRD §2):
   * as demais contam horas APONTADAS no período (`TimeEntry.InicioEm`). O número **não
   * "explica"** as horas ao lado — um chamado aberto em agosto conta em agosto mesmo que
   * as horas dele tenham sido apontadas em setembro. Não somar, não conciliar, não
   * recalcular; se você veio "casar" os dois recortes, pare e leve a decisão ao usuário.
   *
   * **135/G4** — em competência FECHADA vem da coluna congelada
   * (`faturamentosnapshots.qtdetickets`); em corrente/histórica é calculado ao vivo. Chega
   * IGUAL nos dois caminhos: o front **não infere nem calcula nada**.
   *
   * ⚠️ No backend é `int` **NÃO-anulável** com default `0`
   * (`ReportsDtos.cs:314`) — escolha deliberada, porque com
   * `DefaultIgnoreCondition = WhenWritingNull` (`Program.cs:222`) um `int?` nulo
   * **desapareceria do JSON**. Ou seja: a partir da 135 a chave está **sempre presente** e
   * `0` é zero de verdade.
   * O `?` **e** o `| null` aqui não desconfiam disso: eles cobrem o backend **anterior à
   * 135**, que não conhece o campo — o estado normal entre os dois deploys
   * (`135/analise-frontend.md` D-13, ratificado em `tracker.md` R-10).
   *
   * 🔴 Todo guard é `== null`, nunca `=== undefined` (AP-FRONTEND-028), e **`0` NÃO
   * colapsa com ausência**: `0` → `"0"`, ausência/nulo → `"—"` são telas **diferentes**
   * (ao contrário do crédito da 132). Um `?? 0` afirmaria "nenhum chamado aberto" durante
   * toda a janela de deploy — na tela **e na planilha que vai por e-mail**.
   */
  qtdeTickets?: number | null
}

/**
 * Um crédito de horas que compõe o plano efetivo da competência exibida
 * (`ReportsDtos.cs:295`).
 *
 * 🔴 **D15 — `rotulo` NUNCA é renderizado.** O backend já projeta a constante pública
 * (`CreditoRotulos.Publico`, `ReportQueryRepository.cs:990-996`), mas a tela não
 * depende disso: `PlanoComCredito` renderiza `ROTULO_CREDITO_PUBLICO`, constante
 * LOCAL, para que o motivo interno — que pode conter a string proibida
 * `"Problema - Invoicy"` (`FaturamentoConstantes.cs`, AP-SECURITY-001) — não chegue à
 * tela do cliente nem se o backend regredir. O campo existe no tipo porque está no
 * wire; renderizá-lo é o defeito que o teste de wire envenenado deixa vermelho.
 */
export type PlanConsumptionCreditoDto = {
  creditoId: number
  horas: number
  rotulo: string
}

// ── 132/F4d (D12 · C-6 · C-7) — o ENVELOPE da resposta ──────────────────────
//
// 🔴 **A fonte do número vem no PAYLOAD. O front NUNCA a infere pela data.**
// `arquitetura.md` §9.2: nenhuma função do front pode olhar `filters.from`/`filters.to` e
// concluir "isto é um mês fechado" — quem decide é o backend, que sabe se existe snapshot.
// Inferir aqui criaria uma segunda fonte de verdade sobre o que foi FATURADO, e ela
// divergiria em silêncio no primeiro mês reaberto. A proibição é travada por teste
// estrutural (`plan-consumption/fonteDoPeriodo.estrutural.test.ts`), não por disciplina.
//
// ⚠️ **Nenhum destes campos chega no wire hoje**: são 132/B11, que não foi entregue. É por
// isso que o ramo "não sei" (`fonte` ausente) é o ramo NORMAL por enquanto — e ele não
// exibe selo nenhum, que é a única afirmação verdadeira quando não se sabe.

/**
 * Vocabulário do servidor para a origem dos números — **fonte única do conjunto**.
 * `arquitetura.md` §9.2.
 */
export const FONTES_DO_CONSUMO = ['snapshot', 'aovivo'] as const

export type FonteDoConsumo = (typeof FONTES_DO_CONSUMO)[number]

/**
 * `GET /metrics/plan-consumption` — página + envelope de D12.
 *
 * 🔴 **`fonte` é `string` no tipo, não a união literal** (AP-API-002). Declará-lo como
 * `FonteDoConsumo` seria mentir para o compilador sobre um valor que o **servidor** controla:
 * um token novo (`"mosaico"`, um dia) passaria a ser tratado como se fosse um dos dois, sem
 * erro de tipo e sem erro em runtime. A normalização é feita por função pura fail-closed —
 * `normalizarFonte`, em `plan-consumption/fonteDoPeriodoTextos.ts`.
 */
export type PlanConsumptionResponseDto = PaginatedResponse<PlanConsumptionItemDto> & {
  /** `'snapshot'` | `'aovivo'` | qualquer outra coisa ⇒ tratada como desconhecida. */
  fonte?: string | null
  /** `"YYYY-MM"` da competência exibida; ausente em período não-mensal. */
  competencia?: string | null
  /** ISO-8601 do fechamento — só faz sentido com `fonte === 'snapshot'`. */
  competenciaFechadaEm?: string | null
  /** Versão do snapshot: `> 1` significa refechamento (C-8). */
  competenciaVersao?: number | null
  /** C-7 — o período pedido não é uma competência civil ⇒ números ao vivo, crédito zero. */
  avisoPeriodoNaoMensal?: boolean | null
  /** C-6 — competência anterior ao início do congelamento ⇒ recalculada pela regra atual. */
  avisoAnteriorAoCongelamento?: boolean | null
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
  assunto?: string | null
  clienteNome?: string | null
  equipe?: string | null
  ownerNome?: string | null
  status?: string | null
  /**
   * Categoria do HubSpot (ex.: "Problema - Invoicy"). Exibida apenas na TELA
   * (coluna + filtro) desta tela interna — NUNCA no export CSV/Excel (privacidade,
   * AP-SECURITY-001/§8.3). Null quando o backend não classifica o ticket.
   */
  categoria?: string | null
  totalSeconds: number
  apontamentosCount: number
  hubspotUrl?: string | null

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
  statusNome?: string | null
  /** MELH-01 — fonte da cor do badge de Status. NUNCA derivar cor de `status` (texto). */
  statusCategoria?: TicketStatusCategoria | null
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
  projetoNome?: string | null
  stage?: string | null
  clienteNome?: string | null
  equipeAtribuida?: string | null
  atendente: string
  categorizacaoAtendimento?: string | null
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
  ticketId?: number | null
  hubspotTicketId?: string | null
  projetoId?: number | null
  projetoNome?: string | null
  stage?: string | null
  assunto?: string | null
  equipeAtribuida?: string | null
  solicitante?: RequesterDto | null
  atendente: string
  /**
   * Dono/responsável do chamado (owner do ticket) — DISTINTO do `atendente` do
   * apontamento. Vem do backend (096) como chave JSON `donoChamado` (camelCase).
   * Null para origem = 'projeto' (projeto pode não ter owner) ou quando o backend
   * local ainda não expõe o campo — nesse caso o consolidado degrada para o
   * fallback de atendentes distintos.
   */
  donoChamado?: string | null
  categorizacaoAtendimento?: string | null
  /** Propriedade HubSpot 'servico' (118.5.2) — serviço vinculado ao chamado. */
  servico?: string | null
  /** Propriedade HubSpot 'servico__secundario' (118.5.2). */
  servicoSecundario?: string | null
  faturamento: FaturamentoStatus
  aberturaDosChamado?: string | null  // ISO Z (null p/ projeto)
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
  plano?: SupportPlanDto | null
  competencia: string         // YYYY-MM
  totalApontamentos: number
  totalSegundos: number
  /**
   * ⚠️ **Não é o tamanho do plano** — é a soma das horas do período que **consomem** o
   * plano (`ReportQueryRepository.cs:236`, `PlanoSeg`: tudo que não é Invoicy nem
   * "cobrar por fora", incluindo projeto). É este campo que alimenta o cartão rotulado
   * "Plano de Suporte" (a frase está escrita em `competenciaTexts.ts:132-139`).
   *
   * O plano **base** deste relatório é `client.horasEfetivas`, em HORAS. Confundir os dois
   * é o que faz a conferência de `derivarPlanoEfetivo` acusar divergência em todo cliente
   * (132/F9 — ver `client-report/utils/creditoDoRelatorio.ts`).
   */
  horasPlanoSegundos: number
  horasFaturadoSegundos: number
  horasNaoFaturadoSegundos: number
  items?: ClientReportItemDto[] | null

  // ── 132/F9 (§9.5 · D15 · D16 · D20) — CRÉDITO DE HORAS (aditivos) ─────────
  //
  // 🔴 **DUAS UNIDADES no mesmo objeto, e é assim no backend de propósito**
  // (`ReportsDtos.cs:57-96`): todo campo `...Segundos` acima é **segundos**; os dois
  // abaixo são **horas** decimais — a mesma unidade dos campos homônimos do Consumo de
  // Planos, porque é lado a lado com aquela tela que este número é conferido.
  // `formatSeconds(2)` de duas horas de crédito imprime **"0h 0m"**: plausível o
  // suficiente para nunca ser notado numa fatura. Só `formatHours` entra aqui.
  //
  // Os dois são `?` **e** `| null` (AP-FRONTEND-028): no backend são `decimal` NÃO
  // anuláveis com default `0m`, logo o backend novo sempre manda as chaves e o anterior à
  // 132 não manda nenhuma. Os três ramos e o guard `== null` são de
  // `shared/utils/planoEfetivo.ts`; quem os aplica nesta tela é
  // `client-report/utils/creditoDoRelatorio.ts` — **um** lugar, para o cabeçalho e o PDF.

  /**
   * Σ das horas de crédito **vigentes** na competência do relatório. **HORAS.**
   *
   * D20/C-7: período que não é mês civil vem `0` (fail-closed, sem rateio —
   * `ReportService.cs:155-159`). Ausente/`null` = backend anterior à 132 ("não sei"),
   * `0` = "não há": os dois renderizam como hoje, e o discriminador é
   * `creditoConhecido`, nunca o pixel.
   *
   * 🔴 **D15** — este DTO é o artefato que chega ao **cliente** (tela + PDF): ele traz o
   * **total** e nada mais. Não há campo de motivo, lista de créditos nem rótulo do wire —
   * a ausência é a garantia, e o rótulo exibido é a constante local
   * `ROTULO_CREDITO_PUBLICO`.
   */
  creditoHoras?: number | null

  /**
   * `planoBase + creditoHoras` em **HORAS**, com
   * `planoBase = horasOverride ?? supportPlan.horasMes ?? 0` (D16) — a mesma conta do
   * Consumo de Planos, feita pela mesma função no backend
   * (`CalculadoraPlanoEfetivo.Efetivo`).
   *
   * ⚠️ Nome DIFERENTE do campo equivalente do Consumo de Planos
   * (`qtdePlanoEfetivoHoras`), e é o mesmo dado: escrever o nome do outro aqui compila,
   * chega `undefined` em runtime e não tem sintoma. Travado por teste sobre JSON literal
   * em `creditoDoRelatorio.test.ts`.
   *
   * ⚠️ **Não é a fonte de nenhum número exibido.** O default `0m` do construtor
   * posicional do C# imprimiria `0h` como plano do mês contra um backend que ainda não o
   * preenche; aqui ele serve só para DENUNCIAR divergência (em DEV).
   */
  horasPlanoEfetivas?: number | null
}

// ── U6 — Produtividade por Analista ─────────────────────────────────────────

export type AgentMetricDto = {
  userId: number
  nome: string
  equipe?: string | null
  nAtendimentos: number
  totalSegundos: number
  ahtSegundos?: number | null
  mediaPausas?: number | null
}
