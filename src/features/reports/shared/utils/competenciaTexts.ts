/**
 * 123/FAT-1 — textos que explicam **por qual data** as telas de fatura recortam o período.
 *
 * Ficam num módulo próprio pelo mesmo motivo de `plan-consumption/billingExceptionsTexts.ts`:
 * **texto de UI que afirma comportamento do sistema é código, não copy** (AP-FRONTEND-022).
 * "conta pela data de conclusão", "não entra em nenhum período", "continua contando pela data
 * do apontamento" são asserções verificáveis sobre o que a query faz — centralizadas, são
 * testáveis e mudam junto com a regra.
 *
 * ─── Ancoragem de CADA afirmação (lida no backend em 04/09/2026, não presumida) ────────────
 * Prefixo: `bms-core-suporte-backend/src/Suporte.Infrastructure/Repositories/`.
 *
 *  1. "chamado conta no período em que foi CONCLUÍDO"
 *     · Consumo de Planos — elegibilidade da linha: `ReportQueryRepository.cs:686-689`
 *       (`t.FechadoEm != null && t.FechadoEm >= from && t.FechadoEm < toExclusive`);
 *     · `HorasUsadasSeg`  (parcela ticket): `:759-763`;
 *     · `HorasFaturaveisSeg` (parcela ticket): `:775-779`;
 *     · `HorasAnaliseSeg`: `:793-798`;
 *     · Relatório do Cliente — ramo ticket: `:114-118`.
 *     É **substituição** de `TimeEntry.InicioEm`, não conjunção (`:101-113`).
 *
 *  2. "chamado sem data de conclusão não entra em nenhum período"
 *     · consequência algébrica de `FechadoEm != null` nos predicados acima;
 *     · é a população de `GET /reports/billing-exceptions` (`:1486`), que esta mesma tela
 *       já lista no card de exceções.
 *
 *  3. 🔴 131 (decisão do usuário, 08/09/2026) — "apontamento de projeto NÃO consome o
 *     plano de suporte: projeto é contratado à parte". Lido no backend em 08/09/2026,
 *     não presumido:
 *     · Consumo de Planos — `HorasUsadasSeg` é TICKET-ONLY, região
 *       `⟪131 PLANCONSUMO-HORASUSADAS⟫` (`ReportQueryRepository.cs:771-786`); as outras
 *       três colunas do plano (restantes, adicionais, percentual) derivam dela;
 *     · o que SOBROU de projeto nessa tela é a parcela de `HorasFaturaveisSeg` (`:797-803`),
 *       recortada por `te.InicioEm` — "cobrar por fora" nunca foi consumo de plano. Ou
 *       seja: o apontamento de projeto continua registrado e continua faturável;
 *     · a ELEGIBILIDADE mantém o ramo de projeto (`:690-692`): cliente que só teve projeto
 *       no período continua na listagem, agora com `horasUsadas = 0`;
 *     · Relatório do Cliente NÃO mudou (ficou fora do escopo da 131): o ramo de projeto
 *       continua por `InicioEm` (`:146-179`) e continua somado em `PlanoSeg` (`:210`),
 *       rotulado "Plano de Suporte" na tela. A divergência entre as duas telas é
 *       deliberada e está declarada em `ReportQueryRepository.cs:749-756`.
 *     Por isso os dois textos de projeto são CONSTANTES DIFERENTES: até a 131 uma única
 *     frase servia às duas telas, e ela ficou falsa em UMA delas — o tipo de defeito que
 *     não aparece em revisão de redação (AP-FRONTEND-022).
 *
 *  4. "as horas entram na fatura da competência em que o chamado for concluído"
 *     · mesma redação já usada e revisada em `billingExceptionsTexts.ts:38` — **nunca**
 *       "na próxima fatura": por D1 pode ser dali a vários meses, e isso seria afirmação de
 *       prazo que o sistema não garante (AP-FRONTEND-022).
 *
 *  5. "sem datas preenchidas, o período é o mês atual" (só nas telas que consomem
 *     `/metrics/plan-consumption` e `/reports/client`)
 *     · `FusoSaoPaulo.Resolver` (`Suporte.Application/Common/FusoSaoPaulo.cs:148-162`):
 *       `from` ausente → dia 1 do mês local; `to` ausente → último dia do mês local.
 *       Por isso **preencher só uma das duas pontas NÃO significa "em aberto"** — a outra
 *       ponta vira a borda do mês atual, e a frase abaixo diz isso literalmente.
 *     · ⚠️ `GET /reports/tickets` (tabela do detalhe do parceiro) é o oposto: limite ausente
 *       é ausência de restrição (`ReportQueryRepository.cs:1168-1176`, `from == null || …`).
 *       Por isso aquela superfície NÃO usa `textoPeriodoDeConclusao` — ver
 *       `TEXTO_DIVERGENCIA_KPI_TABELA`.
 *
 * Nenhum prazo, limite, periodicidade ou número é digitado aqui.
 */

import { format, parseISO } from 'date-fns'
import { defaultCurrentMonthFullPeriod } from './defaultPeriod'
import { resolverPeriodoPadrao } from './periodoPadrao'

/** "YYYY-MM-DD" → "dd/MM/yyyy" em fuso LOCAL (nunca `new Date(iso)` + UTC: off-by-one). */
function formatarDiaLocal(dia: string): string {
  try {
    return format(parseISO(dia), 'dd/MM/yyyy')
  } catch {
    return dia
  }
}

// ── Bloco fixo: a regra ───────────────────────────────────────────────────────

/** Título do bloco explicativo, ao lado do filtro de período. */
export const TEXTO_COMPETENCIA_TITULO = 'Como o período é contado aqui'

/** A regra, em uma frase, do lado de quem lê. Âncora 1. */
export const TEXTO_COMPETENCIA_REGRA =
  'O chamado conta no período em que foi concluído — não no período em que as horas foram apontadas.'

/** A consequência que o usuário vê e estranha. Âncora 1. */
export const TEXTO_COMPETENCIA_CONSEQUENCIA =
  'Hora apontada num mês, em chamado concluído no mês seguinte, conta inteira no mês da conclusão e não aparece no mês do apontamento.'

/** O que acontece com quem ainda não fechou. Âncoras 2 e 4. */
export const TEXTO_COMPETENCIA_SEM_CONCLUSAO =
  'Chamado ainda sem data de conclusão não entra em período nenhum: as horas dele entram na fatura da competência em que o chamado for concluído.'

/**
 * Rótulo do KPI do Relatório do Cliente que recebe as horas de projeto
 * (`ClientReportHeader.tsx`, alimentado por `report.horasPlanoSegundos` ← `PlanoSeg`,
 * `ReportQueryRepository.cs:210`). Mora aqui para que o texto abaixo NOMEIE o cartão a
 * partir da mesma fonte que o cartão renderiza — renomear o cartão reescreve a frase junto
 * (AP-FRONTEND-022: texto que afirma comportamento nunca é digitado duas vezes).
 */
export const KPI_PLANO_DE_SUPORTE_LABEL = 'Plano de Suporte'

/**
 * Âncora 3, lado **Consumo de Planos** — a tela onde a 131 mudou a regra.
 *
 * ⚠️ Nunca dizer "projeto não é mais cobrado": ele continua registrado e continua
 * faturável (a parcela de projeto de `HorasFaturaveisSeg` segue na query, `:797-803`).
 * O que a 131 tirou foi a CONTA DO PLANO — e um texto que sugerisse o contrário seria
 * pior que o texto antigo.
 */
export const TEXTO_COMPETENCIA_PROJETO_CONSUMO_DE_PLANOS =
  'Apontamento de projeto não consome o plano de suporte: projeto é contratado à parte. Ele continua registrado e continua faturável — só não entra na conta do plano (horas usadas, restantes, adicionais e percentual). O que ainda aparece de projeto nesta tela são as horas marcadas para cobrar fora do plano, contadas pela data do próprio apontamento. Cliente que só teve projeto no período continua na lista, com zero hora usada do plano.'

/**
 * Âncora 3, lado **Relatório do Cliente** — a tela onde a 131 NÃO mexeu.
 *
 * Aqui a frase original continua verdadeira: o ramo de projeto segue recortado por
 * `TimeEntry.InicioEm` (`:146-179`) e suas horas seguem somadas em `PlanoSeg` (`:210`),
 * que é o KPI acima. A segunda oração existe porque, a partir da 131, quem comparar as
 * duas telas encontra números diferentes de propósito.
 */
export const TEXTO_COMPETENCIA_PROJETO_RELATORIO_DO_CLIENTE =
  `Apontamento de projeto não tem chamado e, por isso, continua contando pela data do próprio apontamento. Neste relatório essas horas entram no cartão "${KPI_PLANO_DE_SUPORTE_LABEL}"; no relatório Consumo de Planos elas não entram, porque lá projeto é contratado à parte e não consome o plano.`

// ── Frase dinâmica: qual recorte está aplicado agora ──────────────────────────

type PeriodoArgs = {
  from: string | null
  to: string | null
}

/**
 * Descreve **qual recorte está aplicado**, com as datas da tela — a frase muda com o filtro,
 * porque a pergunta respondida muda com ele.
 *
 * ⚠️ Os ramos de ponta faltante NÃO dizem "em aberto": nas rotas que usam
 * `FusoSaoPaulo.Resolver` a ponta ausente vira a borda do **mês atual** (âncora 5), e dizer
 * "a partir de X" afirmaria uma janela que o backend não abre.
 */
export function textoPeriodoDeConclusao({ from, to }: PeriodoArgs): string {
  if (from && to) {
    return `Mostrando os chamados concluídos entre ${formatarDiaLocal(from)} e ${formatarDiaLocal(to)}.`
  }
  if (from) {
    return `Mostrando os chamados concluídos de ${formatarDiaLocal(from)} até o fim do mês atual.`
  }
  if (to) {
    return `Mostrando os chamados concluídos do primeiro dia do mês atual até ${formatarDiaLocal(to)}.`
  }
  return 'Sem datas preenchidas: mostrando os chamados concluídos no mês atual.'
}

// ── Tooltips das colunas de horas — Consumo de Planos ─────────────────────────
//
// Todas as cinco derivam do MESMO recorte (âncora 1) e por isso todas o declaram: um tooltip
// que diga "no período" sem dizer QUAL data faz o usuário concluir que o sistema perdeu a
// hora que ele apontou no mês filtrado.

/** `HorasUsadasSeg` — exclui Invoicy e "cobrar por fora" (`:755-770`). */
export const TOOLTIP_HORAS_USADAS =
  'Horas do plano nos chamados concluídos no período. Não inclui horas marcadas para cobrar fora do plano nem horas isentas de cobrança.'

/** Derivada: `qtdePlano − horasUsadas` (herda o recorte de `HorasUsadasSeg`). */
export const TOOLTIP_HORAS_RESTANTES =
  'O que sobra do plano depois das horas dos chamados concluídos no período.'

/** Derivada: excedente sobre o plano (herda o mesmo recorte). */
export const TOOLTIP_HORAS_ADICIONAIS =
  'Horas além do plano contratado, contando os chamados concluídos no período.'

/** `HorasFaturaveisSeg` — apontamentos com "cobrar por fora" (`:771-787`). */
export const TOOLTIP_HORAS_FATURAVEIS =
  'Horas marcadas para cobrar fora do plano, nos chamados concluídos no período.'

/** `HorasAnaliseSeg` — chamados da categoria de análise interna (`:788-799`). */
export const TOOLTIP_HORAS_ANALISE =
  'Horas isentas de cobrança, em chamados de análise interna concluídos no período.'

// ── Tooltips dos KPIs do detalhe do parceiro ──────────────────────────────────
//
// Os KPIs do drawer vêm da MESMA linha de `/metrics/plan-consumption` da tela-mãe
// (`client-tickets/services/clientTicketsService.ts::getClientKpis`), logo herdam
// exatamente os recortes acima.

export const TOOLTIP_KPI_HORAS_USADAS = TOOLTIP_HORAS_USADAS
export const TOOLTIP_KPI_HORAS_RESTANTES = TOOLTIP_HORAS_RESTANTES
export const TOOLTIP_KPI_HORAS_FATURAVEIS = TOOLTIP_HORAS_FATURAVEIS

/**
 * Torna LEGÍVEL a divergência que convive dentro do mesmo modal — sem resolvê-la.
 *
 * A resolução depende da decisão de produto **DP-7** (ainda aberta) e mexeria em query do
 * backend; aqui a tela apenas para de esconder que são duas perguntas diferentes:
 *  - KPIs      → `Ticket.FechadoEm`   (`ReportQueryRepository.cs:753-770`) — a fatura;
 *  - "Tempo no período" → `TimeEntry.InicioEm` (`:1168-1176`) — o trabalho do dia a dia.
 * A divisão está declarada como deliberada no XML-doc de `GetTicketsReportAsync` (`:917-924`).
 */
export const TEXTO_DIVERGENCIA_KPI_TABELA =
  'Os cartões acima contam pela data de conclusão do chamado (é o que vai para a fatura). A coluna "Tempo no período" da tabela conta pela data do apontamento (é o trabalho realizado). Os dois números não fecham entre si, e isso é proposital.'

// ── Coluna "Concluído em" (a data que explica tudo) ───────────────────────────

export const HEADER_CONCLUIDO_EM = 'Concluído em'

/**
 * `/reports/tickets` → `fechadoEm`; `/reports/client` → `fechadoEmChamado`. Mesma origem
 * (`Ticket.FechadoEm`), nomes de chave diferentes no wire — conferido nos dois DTOs
 * (`ReportsDtos.cs:51` e `:265`).
 */
export const TOOLTIP_CONCLUIDO_EM =
  'Data em que o chamado foi concluído. É ela que decide em qual fatura as horas do chamado entram — inclusive as apontadas em meses anteriores. "—" = chamado ainda sem data de conclusão.'

// ── Baldes de fatura do chamado (all-time) ────────────────────────────────────
//
// `FaturaPlanoSegundos` / `FaturaFaturadoSegundos` / `FaturaAnaliseSegundos`
// (`ReportQueryRepository.cs:1198-1204` + split em `:1250-1260`): somam os apontamentos
// **concluídos** do chamado, SEM recorte de período — a competência é a do chamado
// (`entraNaFatura`), não a de cada apontamento. Por isso o sufixo "(chamado)" no cabeçalho:
// sem ele, o usuário soma estas colunas com "Tempo no período", que é outra janela.

const SUFIXO_BALDE =
  'Soma dos apontamentos concluídos do chamado, sem recorte de período — a competência é a data de conclusão do chamado, não a de cada apontamento.'

export const HEADER_BALDE_PLANO = 'Plano (chamado)'
export const TOOLTIP_BALDE_PLANO = `Horas que consomem o plano de suporte. ${SUFIXO_BALDE}`

export const HEADER_BALDE_FATURADO = 'Cobrado por fora (chamado)'
export const TOOLTIP_BALDE_FATURADO = `Horas marcadas para cobrar fora do plano. ${SUFIXO_BALDE}`

export const HEADER_BALDE_ANALISE = 'Análise (chamado)'
export const TOOLTIP_BALDE_ANALISE = `Horas isentas de cobrança, em chamado de análise interna. ${SUFIXO_BALDE}`

// ── Filtro "somente o que entra na fatura" ────────────────────────────────────
//
// Liga o parâmetro `apenasFatura` de `GET /reports/tickets`
// (`ReportsController.cs:254`; predicado em `ReportQueryRepository.cs:1032-1036`, aplicado
// ANTES do `CountAsync` — a paginação acompanha o recorte).
//
// ⚠️ Nasce DESLIGADO de propósito: o padrão da tela é mostrar também os chamados em aberto,
// que é instrução explícita do usuário no documento de QA da 121
// (`121-qa-rodada3-pendentes/fonte-documento-qa.md:30`). Ligá-lo por padrão mudaria o
// conjunto de linhas sem decisão de produto (DP-7).

export const TEXTO_APENAS_FATURA_LABEL = 'Só o que entra na fatura do período'

export const TEXTO_APENAS_FATURA_INFO =
  'Desligado, a lista mostra também os chamados ainda em aberto e os concluídos em outra competência — é a visão de conferência. Ligado, ficam só os chamados concluídos dentro do período filtrado, que são os que entram nesta fatura.'

// ── 123/FE-PER (D-2) — o período do detalhe do parceiro, dito em voz alta ─────
//
// A tela passou a ter UM período só, resolvido no painel (`shared/utils/periodoPadrao.ts`,
// que traz a justificativa completa e as âncoras de backend). O texto abaixo existe porque
// **default invisível é defeito de comunicação**: se a tela cai no mês atual sem dizer, quem
// olha conclui que os números estão errados — que é literalmente o relato que originou a D-2.
//
// Não afirma prazo, limite nem periodicidade: só imprime as duas datas que a tela mandou ao
// backend (AP-FRONTEND-022).

/**
 * 121/§4.5 (D2) + 123/FE-FIX3 (ressalva `F-2`) — rótulo e subtexto do KPI "Em aberto".
 *
 * `horasEmAbertoNaoFaturadas` é um **ESTOQUE, all-time**: por definição não reage ao filtro
 * de período (soma os apontamentos de chamados com `FechadoEm == null`, sem recorte).
 * Sem esta frase na tela, o próximo QA humano reabre o relato do P4 ("o filtro de data não
 * tem efeito") — §12/R12 da arquitetura. Redação verbatim de §4.5.
 *
 * Estas duas constantes moraram em `ClientTicketsPanel.tsx` até a 123/FE-FIX3. Vieram para
 * cá porque `textoPeriodoDoDetalhe` precisa **nomear este cartão** como a exceção da frase
 * de período: o QA achou as duas frases na mesma dobra — uma dizendo "os cartões … usam
 * este mesmo período", a outra "independe do período" —, verdadeiras isoladamente e
 * contraditórias juntas. Com o rótulo saindo da MESMA constante que o cartão renderiza,
 * renomear o cartão reescreve a exceção junto (`AP-FRONTEND-022`: texto de UI que afirma
 * comportamento entra com a âncora ao lado, nunca digitado duas vezes).
 */
export const KPI_EM_ABERTO_LABEL = 'Em aberto (não faturável ainda)'
export const KPI_EM_ABERTO_TEXTO =
  'Total, independe do período — trabalho em chamados ainda sem data de conclusão.'

/** Complemento quando a janela em uso é exatamente o mês atual (padrão da tela). */
const SUFIXO_MES_ATUAL =
  'É o mês atual, que é o padrão da tela — troque as datas no filtro para ver outro período.'

/**
 * Frase do período do detalhe do parceiro, com as datas EFETIVAS (as que foram ao wire).
 *
 * A tela SEMEIA os campos De/Até com o mês atual, então "é o padrão" não pode ser deduzido
 * de campo em branco: o estado normal do padrão é justamente **campo preenchido**. O que a
 * frase afirma é verificável do jeito certo — a janela em uso **é** o mês atual —, e vale
 * igual se o usuário tiver digitado essas mesmas datas. Deduzir de `null` diria "período
 * escolhido por você" para o padrão da tela, que é a mentira de origem da D-2.
 *
 * Ponta em branco ganha frase própria e tem precedência: ali o usuário mexeu e precisa saber
 * de onde saiu o valor que a tela usou no lugar.
 *
 * `agora` é injetável para que o teste fixe o mês sem depender do relógio da máquina.
 */
export function textoPeriodoDoDetalhe(
  { from, to }: PeriodoArgs,
  agora: Date = new Date(),
): string {
  const efetivo = resolverPeriodoPadrao({ from, to }, agora)
  const base =
    `Período em uso: ${formatarDiaLocal(efetivo.from)} a ${formatarDiaLocal(efetivo.to)}. ` +
    `A tabela e os cartões abaixo usam este mesmo período — menos o cartão ` +
    `"${KPI_EM_ABERTO_LABEL}", que é um total acumulado.`

  if (from == null && to == null) return `${base} ${SUFIXO_MES_ATUAL}`
  if (from == null) {
    return `${base} A data inicial ficou em branco, então vale o primeiro dia do mês atual.`
  }
  if (to == null) {
    return `${base} A data final ficou em branco, então vale o último dia do mês atual.`
  }

  // 123/FE-FIX3 (F-3): o mês atual vem de `defaultCurrentMonthFullPeriod`, o dono
  // estabelecido do conceito — a mesma função que `resolverPeriodoPadrao` usa. Duas
  // implementações do "mês atual" fariam esta comparação divergir do valor comparado.
  const mesAtual = defaultCurrentMonthFullPeriod(agora)
  const ehMesAtual = efetivo.from === mesAtual.from && efetivo.to === mesAtual.to
  return ehMesAtual ? `${base} ${SUFIXO_MES_ATUAL}` : base
}

// ── 123/FE-PER (D-14 / AUTO-1) — as duas telas de consumo, rotuladas ──────────
//
// Mesmo conceito ("quanto deste plano o cliente consumiu"), DUAS datas — e as duas estão
// certas por decisão do usuário. Medido no backend em 05/09/2026:
//
//  · **Saúde dos Planos** `GET /metrics/plan-health` → `GetPlanHealthRawAsync`
//    (`Suporte.Infrastructure/Repositories/MetricsQueryRepository.cs:1258-1266`): soma
//    `te.TotalSegundos` com `te.InicioEm >= from && te.InicioEm < toExclusive` — a data em
//    que o time LANÇOU a hora. É o "medidor ao vivo" que o usuário pediu na D-14:
//    *"a saúde dos planos deve ir marcando conforme o time vai lançando os tempos"*.
//  · **Consumo de Planos** `GET /metrics/plan-consumption` → `HorasUsadasSeg`
//    (`ReportQueryRepository.cs:759-763`): recorta por `Ticket.FechadoEm` — a data em que o
//    CHAMADO foi concluído. É a regra de faturamento (Bloco C do PRD da 123).
//
// ⚠️ Esta unidade é de TEXTO. Nenhuma consulta trocou de campo de data: a divergência é
// legítima e some quando explicada — hoje ela só parecia erro.
//
// 🔴 131 (08/09/2026) — A CAUSA "HORAS DE PROJETO" ACABOU; A DIVERGÊNCIA, NÃO.
//
// Até a 131 estes dois textos diziam que a divergência tinha DUAS causas: a data e o fato
// de o Consumo de Planos somar horas de projeto. A segunda deixou de existir — mas quem
// concluir daí que "agora os números batem" erra. Conferido na fonte em 08/09/2026:
//
//  · **a data, que PERMANECE**: `plan-health` recorta por `te.InicioEm`
//    (`MetricsQueryRepository.cs:1465-1473`); `plan-consumption` recorta a parcela de
//    ticket por `Ticket.FechadoEm` (`ReportQueryRepository.cs:777-785`, região
//    `⟪131 PLANCONSUMO-HORASUSADAS⟫`).
//  · **quem entra na lista — a TERCEIRA razão, que nenhum texto jamais mencionou**:
//    `plan-health` só considera cliente COM plano (`c.SupportPlanId != null`,
//    `MetricsQueryRepository.cs:1459`), enquanto `plan-consumption` também lista cliente
//    SEM plano que teve consumo real no período (`ReportQueryRepository.cs:683-693`).
//  · **as horas de projeto, que SAÍRAM**: `HorasUsadasSeg` passou a ser ticket-only
//    (`:777-785`), como `HorasConsumidas` do plan-health sempre foi (`:1465-1474`). Os
//    textos passam a dizer isso na afirmativa — "nenhum dos dois conta projeto no plano" —
//    em vez de apresentá-lo como diferença.
//
// ⚠️ Por isso nenhum dos dois textos volta a FECHAR a enumeração num número ("por essas
// duas razões"). Fechar é afirmar que a lista é completa, e ela não é: além das duas
// acima, o `plan-consumption` ainda estreita por equipe para o perfil atendente
// (`ReportQueryRepository.cs:712-719`), enquanto o `plan-health` é sempre global
// (`MetricsQueryRepository.cs:1454`). Foi exatamente um número fechado — "duas razões" —
// que ficou falso quando uma das razões sumiu.
//
// O que coincide nos dois lados (e por isso nenhum texto fala em "critérios diferentes"
// de forma vaga): ambos exigem `Status == Completed`, `DesativadoEm == null` e
// `!FatureiFora`, e ambos excluem a categoria Invoicy
// (`MetricsQueryRepository.cs:1468-1470` × `ReportQueryRepository.cs:779-782`).

/** Rótulo curto do card Saúde dos Planos — fica visível em todos os estados. */
export const TEXTO_SAUDE_PLANOS_ROTULO =
  'Medidor ao vivo: a hora entra no mês em que o time a lançou.'

/** Por que este número pode não bater com o do relatório de fatura. */
export const TEXTO_SAUDE_PLANOS_COMPARACAO =
  'O relatório Consumo de Planos conta pela data em que o chamado foi concluído, que é a regra da fatura, e lista também cliente sem plano contratado; este medidor conta pela data em que o time lançou a hora e mostra só quem tem plano. Por diferenças como essas, os dois podem mostrar números diferentes no mesmo mês — e os dois estão certos. Hora de projeto não consome plano em nenhum dos dois: projeto é contratado à parte, e continua registrado e faturável.'

/** O irmão da frase acima, na tela de Consumo de Planos (mesma explicação, outro lado). */
export const TEXTO_COMPETENCIA_VS_SAUDE_PLANOS =
  'O gráfico Saúde dos Planos, no painel, conta pela data em que o time lançou a hora, para acompanhar o plano ao vivo, e mostra só clientes com plano contratado; esta tela conta pela data em que o chamado foi concluído, que é a regra da fatura, e lista também cliente sem plano que teve consumo. Por diferenças como essas, ele pode mostrar um número diferente do desta tela no mesmo mês — e os dois estão certos. Nenhum dos dois conta hora de projeto no plano.'
