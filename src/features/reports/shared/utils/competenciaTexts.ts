/**
 * 123/FAT-1 · **reescrito por 132/F3 (D1)** — textos que explicam **por qual data** as telas de
 * fatura recortam o período, e o que o **crédito de horas** faz com o plano.
 *
 * Ficam num módulo próprio porque **texto de UI que afirma comportamento do sistema é código,
 * não copy** (AP-FRONTEND-022): "a hora conta no período em que foi apontada", "o crédito vale
 * só nesta competência", "chamado em aberto também entra" são asserções verificáveis sobre o
 * que a query faz — centralizadas, são testáveis e mudam junto com a regra.
 *
 * ─── 🔴 132/D1 — A REGRA INVERTEU, E ESTE ARQUIVO INTEIRO FOI REANCORADO ────────────────────
 *
 * Até a 132 a competência de faturamento era **`Ticket.FechadoEm`** (a data de conclusão do
 * chamado), e todos os textos daqui diziam isso. A decisão D1 do usuário trocou a regra: **a
 * competência é o mês do apontamento** (`TimeEntry.InicioEm`). Os textos antigos não ficaram
 * imprecisos — ficaram **exatamente invertidos**, e um texto invertido é pior que texto
 * ausente: ele ensina a regra errada com a autoridade da tela.
 *
 * Ancoragem de CADA afirmação, **lida no backend em 2026-09-09** (depois de B1/B2 entregues,
 * como manda `analise-frontend.md` §6.3), nunca presumida. Prefixo:
 * `bms-core-suporte-backend/src/Suporte.Infrastructure/Repositories/`.
 *
 *  1. "a hora conta no período em que foi APONTADA"
 *     · Consumo de Planos — as três parcelas de ticket, região
 *       `⟪121/A1 PLANCONSUMO-TICKET⟫` (`ReportQueryRepository.cs:883-943`):
 *       `te.InicioEm >= from && te.InicioEm < toExclusive`;
 *     · Consumo de Planos — elegibilidade da linha, região
 *       `⟪121/A1 PLANCONSUMO-ELEGIBILIDADE⟫` (`:819-831`): idem;
 *     · Relatório do Cliente — ramo ticket, região `⟪121/A1 RAMO-TICKET⟫` (`:119-170`): idem.
 *       O ramo de projeto (`⟪121/A1 RAMO-PROJETO⟫`, `:172-205`) **já era** `InicioEm`.
 *     É **substituição**, não conjunção: o próprio backend escreve, em `:122-124`, que
 *     *"`Ticket.FechadoEm` NÃO participa de nenhuma decisão de fatura"*.
 *
 *  2. "chamado ainda em aberto TAMBÉM entra"
 *     · consequência algébrica de o predicado ter deixado de exigir `FechadoEm != null`;
 *     · e é o motivo pelo qual a população de exceções de faturamento **deixou de existir**
 *       (132/D7): o card e o endpoint que a listavam foram removidos na 132/B5+F1.
 *
 *  3. 🔴 **132/D11 — o plano da competência pode ter CRÉDITO somado.**
 *     · `CreditoHoras` = Σ das horas dos créditos com `competencia == C`,
 *       `estornadoem IS NULL` e `desativadoem IS NULL` (`ReportQueryRepository.cs:969-999`);
 *     · `QtdePlanoEfetivoHoras = QtdePlanoHoras + CreditoHoras`, e **as três derivadas**
 *       (restantes, adicionais, percentual) saem da `CalculadoraPlanoEfetivo` sobre o
 *       efetivo (`:1006-1043`);
 *     · **D20 / C-7 — fail-closed:** período que não é uma competência civil ⇒ crédito
 *       **zero**, sem rateio (`:967-975`, `CompetenciaCivil.TryDe`). Por isso nenhum texto
 *       daqui promete crédito: eles dizem *"quando há"*.
 *     · **D15** — o rótulo público do crédito vem de `shared/utils/creditoTexts.ts` e é
 *       INTERPOLADO, nunca digitado: renomear o rótulo reescreve estas frases junto
 *       (AP-FRONTEND-028, o 5º lugar — a prosa que NOMEIA um elemento).
 *
 *  4. 🔴 131 (decisão do usuário, 2026-09-08) — "apontamento de projeto NÃO consome o plano de
 *     suporte: projeto é contratado à parte". **Não foi revogada pela 132**, e continua lida
 *     na fonte:
 *     · Consumo de Planos — `HorasUsadasSeg` é TICKET-ONLY, região
 *       `⟪131 PLANCONSUMO-HORASUSADAS⟫` (`ReportQueryRepository.cs:900-914`); as outras três
 *       colunas do plano derivam dela;
 *     · o que SOBROU de projeto nessa tela é a parcela de `HorasFaturaveisSeg` (`:915-931`) —
 *       "cobrar por fora" nunca foi consumo de plano;
 *     · a ELEGIBILIDADE mantém o ramo de projeto (`:826-828`): cliente que só teve projeto no
 *       período continua na listagem, com `horasUsadas = 0`;
 *     · Relatório do Cliente NÃO mudou pela 131: projeto continua somado em `PlanoSeg` e
 *       rotulado "Plano de Suporte" na tela. A divergência entre as duas telas é deliberada.
 *
 *  5. "sem datas preenchidas, o período é o mês atual" (só nas telas que consomem
 *     `/metrics/plan-consumption` e `/reports/client`)
 *     · `FusoSaoPaulo.Resolver` (`Suporte.Application/Common/FusoSaoPaulo.cs`): `from`
 *       ausente → dia 1 do mês local; `to` ausente → último dia do mês local. Por isso
 *       **preencher só uma das duas pontas NÃO significa "em aberto"**.
 *     · ⚠️ `GET /reports/tickets` (tabela do detalhe do parceiro) é o oposto: limite ausente é
 *       ausência de restrição (`ReportQueryRepository.cs:1257-1264`, `from == null || …`).
 *
 *  6. 🔴 **132/D1 — os baldes de fatura do chamado DEIXARAM de ser all-time.**
 *     Eles somavam sem recorte, porque a competência era a do próprio chamado. Agora são
 *     recortados pela janela pedida, região `⟪132 JANELA-COMPETENCIA⟫`
 *     (`ReportQueryRepository.cs:1423-1456`) — os mesmos limites half-open sobre
 *     `te.InicioEm` da região operacional `⟪132 JANELA-OPERACIONAL⟫` (`:1395-1411`). As duas
 *     janelas **coincidem em valor** e continuam **distintas em propósito** (o backend
 *     declara isso em `:1122-1128`): deletar uma delas foi vetado pelo usuário (PRD §8.1).
 *
 *  7. `apenasFatura` = "a soma dos apontamentos ativos e concluídos na janela é maior que
 *     zero" (`ReportQueryRepository.cs:1257-1264`; `Sum(...) > 0`, nunca `Any(...)` —
 *     132/BE-D1). ⚠️ **Chamado em aberto com hora no período agora PASSA por este filtro** —
 *     antes era exatamente o que ele excluía (o XML-doc do backend diz isso em `:1140-1141`).
 *
 * Nenhum prazo, limite, periodicidade ou número é digitado aqui.
 */

import { format, parseISO } from 'date-fns'
import { ROTULO_CREDITO_PUBLICO } from './creditoTexts'
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

/**
 * A regra, em uma frase, do lado de quem lê. Âncora 1.
 *
 * 🔴 132/D1 — esta frase é a **inversão exata** da que vivia aqui ("o chamado conta no período
 * em que foi concluído"). Ela nomeia as duas datas de propósito: quem já conhecia a regra velha
 * precisa ler qual delas deixou de valer, senão lê a frase nova como se fosse a antiga.
 */
export const TEXTO_COMPETENCIA_REGRA =
  'A hora conta no período em que foi apontada — não no período em que o chamado foi concluído.'

/** A consequência que o usuário vê e estranha. Âncora 1. */
export const TEXTO_COMPETENCIA_CONSEQUENCIA =
  'Hora apontada num mês conta inteira nesse mês, mesmo que o chamado só seja concluído depois: a data de conclusão não muda mais o mês de nenhuma hora.'

/**
 * O que acontece com quem ainda não fechou. Âncora 2.
 *
 * 🔴 Renomeada de `TEXTO_COMPETENCIA_SEM_CONCLUSAO` em 132/F3: o nome antigo descrevia a
 * **ausência de conclusão** como um estado que tirava as horas de todo período, e era essa
 * ausência que o conceito removido pela D7 media. Não sobrou nada dela — o nome mentia junto
 * com o texto.
 */
export const TEXTO_COMPETENCIA_CHAMADO_EM_ABERTO =
  'Chamado ainda em aberto também entra: as horas dele já contam no período em que foram apontadas, sem esperar a conclusão.'

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
 * 🔴 **132/F3 — renomeada de `textoPeriodoDeConclusao`.** O nome afirmava o predicado, e o
 * predicado trocou (D1). Nome de função que descreve regra é parte do texto: mantê-lo
 * obrigaria o próximo leitor a descobrir, lendo o corpo, que ele mente.
 * O sujeito também mudou — de "os chamados" para "as horas": com a competência no
 * apontamento, é a HORA que entra num período, não o chamado.
 *
 * ⚠️ Os ramos de ponta faltante NÃO dizem "em aberto": nas rotas que usam
 * `FusoSaoPaulo.Resolver` a ponta ausente vira a borda do **mês atual** (âncora 5), e dizer
 * "a partir de X" afirmaria uma janela que o backend não abre.
 */
export function textoPeriodoDeApontamento({ from, to }: PeriodoArgs): string {
  if (from && to) {
    return `Mostrando as horas apontadas entre ${formatarDiaLocal(from)} e ${formatarDiaLocal(to)}.`
  }
  if (from) {
    return `Mostrando as horas apontadas de ${formatarDiaLocal(from)} até o fim do mês atual.`
  }
  if (to) {
    return `Mostrando as horas apontadas do primeiro dia do mês atual até ${formatarDiaLocal(to)}.`
  }
  return 'Sem datas preenchidas: mostrando as horas apontadas no mês atual.'
}

// ── Tooltips das colunas de horas — Consumo de Planos ─────────────────────────
//
// Todas derivam do MESMO recorte (âncora 1) e por isso todas o declaram: um tooltip que diga
// "no período" sem dizer QUAL data faz o usuário concluir que o sistema perdeu a hora que ele
// apontou no mês filtrado — é o relato B2 literal, e a razão de este módulo existir.
//
// 🔴 132/F3 — as cinco diziam "nos chamados CONCLUÍDOS no período" e passaram a dizer
// "apontadas no período" (D1). Três delas ganharam também o plano EFETIVO (D11): restantes,
// adicionais e percentual são calculadas sobre `contrato + crédito`
// (`ReportQueryRepository.cs:1006-1043`), e um tooltip que ainda dissesse "plano contratado"
// explicaria um número que a tela não mostra mais.

/**
 * 🆕 132/F4b — a coluna "Qtde. Plano (h)", que **antes não tinha tooltip nenhum**.
 *
 * Ela ganhou um porque deixou de ser dado de cadastro: o crédito é por **competência**
 * (`creditoshoras.competencia`), logo o número desta coluna passou a **depender do período
 * filtrado**. A célula exibe `15h + 2h` e sem esta explicação o `+ 2h` é um glifo sem
 * antecedente.
 *
 * ⚠️ O rótulo do crédito é INTERPOLADO de `creditoTexts.ts` (D15): renomear o rótulo reescreve
 * esta frase junto. É o 5º lugar de AP-FRONTEND-028 — a prosa que nomeia um elemento da tela.
 */
export const TOOLTIP_QTDE_PLANO =
  `Horas contratadas do plano. Quando há ${ROTULO_CREDITO_PUBLICO} na competência, ele aparece somado ao lado e entra nas horas restantes, nas adicionais e no percentual.`

/** `HorasUsadasSeg` — ticket-only, exclui Invoicy e "cobrar por fora" (`:900-914`). */
export const TOOLTIP_HORAS_USADAS =
  'Horas do plano apontadas no período. Não inclui horas marcadas para cobrar fora do plano nem horas isentas de cobrança.'

/** Derivada: `planoEfetivo − horasUsadas` (`CalculadoraPlanoEfetivo`, `:1021`). */
export const TOOLTIP_HORAS_RESTANTES =
  `O que sobra do plano da competência — contrato mais ${ROTULO_CREDITO_PUBLICO}, quando há — depois das horas apontadas no período.`

/** Derivada: excedente sobre o plano EFETIVO (`:1022`). */
export const TOOLTIP_HORAS_ADICIONAIS =
  `Horas além do plano da competência, contrato mais ${ROTULO_CREDITO_PUBLICO} quando há, contando as horas apontadas no período.`

/** `HorasFaturaveisSeg` — apontamentos com "cobrar por fora", ticket e projeto (`:915-931`). */
export const TOOLTIP_HORAS_FATURAVEIS =
  'Horas marcadas para cobrar fora do plano, apontadas no período.'

/** `HorasAnaliseSeg` — chamados da categoria de análise interna (`:932-942`). */
export const TOOLTIP_HORAS_ANALISE =
  'Horas isentas de cobrança, em chamados de análise interna, apontadas no período.'

// ── 135/G1 — a CONTAGEM DE CHAMADOS, e por que ela tem dois textos ────────────
//
// 🔴 A coluna "Qtde. Tickets" é a ÚNICA desta tela cujo recorte é a data de ABERTURA do
// chamado (`Ticket.HsCriadoEm`), e não o apontamento. Por isso os dois textos abaixo NÃO
// entram em `TEXTOS_QUE_DECLARAM_APONTAMENTO` (o record de `competenciaTexts.test.ts` que
// exige `/apontad/`): pô-los lá deixaria a identidade daquele conjunto vermelha E faria a
// lista afirmar o que não é. A decisão está declarada nos dois lados.
//
// Por que DOIS textos, e não um: o do cabeçalho tem de caber no balão do `InfoIcon`
// (`whitespace-nowrap` — o clamp reposiciona, não quebra linha ⇒ ~90 caracteres); a
// explicação do CONTRASTE entre os dois recortes não cabe em 90 caracteres e vive no
// disclosure "(?)" da tela.

/**
 * 🆕 135/G1 — `headerInfo` da coluna "Qtde. Tickets".
 *
 * Declara o recorte pela **abertura** (`Ticket.HsCriadoEm ∈ [from, toExclusive)` +
 * `DesativadoEm IS NULL`) e o "independente do status atual" — as duas coisas que fazem o
 * número não bater com o KPI de horas ao lado, de propósito (PRD §2).
 *
 * ⚠️ Curto por **restrição medida**, não por estilo: balão `whitespace-nowrap`, limite
 * prático ~90 caracteres (`132/§3.3`). **Não alterar `InfoIcon.tsx`.**
 */
export const TOOLTIP_QTDE_TICKETS =
  'Chamados abertos no período, pela data de abertura, em qualquer status atual.'

/**
 * 🆕 135/G1 — o parágrafo do disclosure "(?)": explica **por que os dois números não se
 * explicam entre si**.
 *
 * Ele fica **ao lado** de `<CompetenciaNota>` em `PlanConsumptionHelp.tsx`, nunca dentro
 * dela: `CompetenciaNota` é compartilhada com o Relatório do Cliente, que **não tem** esta
 * coluna, e um parágrafo incondicional lá afirmaria a existência de uma coluna inexistente
 * naquela tela (AP-FRONTEND-028, o 5º lugar — a 132 já pagou esse defeito uma vez).
 *
 * ✅ O nome acessível do `(?)` ("como o período é contado nesta tela") **continua
 * verdadeiro**: este parágrafo é exatamente sobre como o período é contado. A explicação de
 * G3 (o filtro) **não** entra aqui — ela não é sobre período e vive no `InfoIcon` do filtro
 * (`plan-consumption/usoDoPlanoTextos.ts`).
 *
 * 🔴 Jargão de banco/entidade é proibido em texto de UI (detector de
 * `columns.competencia.test.ts`): "data de abertura", nunca `HsCriadoEm`.
 */
export const TEXTO_QTDE_TICKETS_RECORTE_PROPRIO =
  'A contagem de chamados usa um recorte próprio: ela conta os chamados ABERTOS no período, ' +
  'pela data de abertura, em qualquer status atual. As colunas de horas contam as horas ' +
  'APONTADAS no período. Por isso os dois números não se explicam entre si: um chamado ' +
  'aberto em agosto conta em agosto, mesmo que as horas dele tenham sido apontadas em ' +
  'setembro; e um chamado aberto no período sem nenhuma hora conta na quantidade e não ' +
  'aparece nas horas.'

// ── Tooltips dos KPIs do detalhe do parceiro ──────────────────────────────────
//
// Os KPIs do drawer vêm da MESMA linha de `/metrics/plan-consumption` da tela-mãe
// (`client-tickets/services/clientTicketsService.ts::getClientKpis`), logo herdam
// exatamente os recortes acima.

export const TOOLTIP_KPI_HORAS_USADAS = TOOLTIP_HORAS_USADAS
export const TOOLTIP_KPI_HORAS_RESTANTES = TOOLTIP_HORAS_RESTANTES
export const TOOLTIP_KPI_HORAS_FATURAVEIS = TOOLTIP_HORAS_FATURAVEIS

/**
 * 🆕 132/F3 — o cartão "Extras (estouro)" do painel do parceiro tinha o texto **digitado
 * inline** ("Horas consumidas além do plano contratado."), e "contratado" ficou falso com o
 * plano efetivo (D11). Digitado inline, ele não era alcançado por nenhum dos detectores deste
 * módulo — que é o defeito que AP-FRONTEND-022 descreve. Agora sai daqui, como os outros três.
 */
export const TOOLTIP_KPI_HORAS_ADICIONAIS = TOOLTIP_HORAS_ADICIONAIS

/**
 * 🔴 **132/F3 — este texto INVERTEU por completo, e é o caso mais delicado do arquivo.**
 *
 * Ele dizia: *"os cartões contam pela data de conclusão; a coluna 'Tempo no período' conta pela
 * data do apontamento; os dois números **não fecham** entre si, e isso é proposital."*
 * Com a D1 as duas janelas passaram a recortar pela MESMA data
 * (`⟪132 JANELA-OPERACIONAL⟫` × `⟪132 JANELA-COMPETENCIA⟫`,
 * `ReportQueryRepository.cs:1395-1456`) — o texto passou a afirmar, com autoridade de tela, uma
 * divergência de datas que **deixou de existir**, e a chamá-la de proposital.
 *
 * ⚠️ **Mas ele não pode virar "agora os números batem".** As duas janelas convergiram em
 * **valor**, não em **propósito** (PRD §8.1: *"não deletar a janela operacional"*), e os
 * números continuam podendo diferir por outro motivo: os cartões medem **consumo do plano**
 * (ticket-only, sem as horas marcadas para cobrar fora e sem as isentas — `:900-914`), e a
 * coluna mede **todo o tempo apontado** no chamado (`:1402-1411`). Prometer igualdade seria
 * trocar uma afirmação falsa por outra.
 *
 * A formulação abaixo descreve **o que cada número mede** e não afirma nada sobre a relação
 * entre eles — é o único enunciado que continua verdadeiro se a decisão de produto DP-7
 * unificar, ou não, as duas janelas.
 */
export const TEXTO_DIVERGENCIA_KPI_TABELA =
  'Os cartões acima medem o consumo do plano: só horas de chamado, sem as marcadas para cobrar fora do plano e sem as isentas de cobrança. A coluna "Tempo no período" da tabela mede todo o tempo apontado no chamado. As duas contam pela data do apontamento e respondem perguntas diferentes.'

// ── Coluna "Concluído em" (a data que explica tudo) ───────────────────────────

export const HEADER_CONCLUIDO_EM = 'Concluído em'

/**
 * `/reports/tickets` → `fechadoEm`; `/reports/client` → `fechadoEmChamado`. Mesma origem
 * (`Ticket.FechadoEm`), nomes de chave diferentes no wire.
 *
 * 🔴 **132/F3 — a COLUNA fica, o tooltip é que mudou.** A data de conclusão continua sendo
 * dado operacional legítimo ("quando o chamado encerrou") e o backend continua projetando-a
 * de propósito — o que ela perdeu foi o **poder de decidir a fatura**: o próprio repositório
 * escreve que *"`Ticket.FechadoEm` NÃO participa de nenhuma decisão de fatura"*
 * (`ReportQueryRepository.cs:122-124`). Deixar o tooltip antigo faria a tela ensinar a regra
 * revogada exatamente na coluna onde ela era mais convincente.
 */
export const TOOLTIP_CONCLUIDO_EM =
  'Data em que o chamado foi concluído. É informação operacional: ela não decide mais em qual fatura as horas entram — quem decide é a data de cada apontamento. "—" = chamado ainda em aberto.'

// ── Baldes de fatura do chamado ───────────────────────────────────────────────
//
// `FaturaPlanoSegundos` / `FaturaFaturadoSegundos` / `FaturaAnaliseSegundos`, região
// `⟪132 JANELA-COMPETENCIA⟫` (`ReportQueryRepository.cs:1423-1456`) + split pelo
// `ClassificadorFaturamento`.
//
// 🔴 **132/D1 — eles DEIXARAM de ser all-time.** Eram somas sem recorte, porque a competência
// era a do próprio chamado; agora são recortados pela janela pedida, pelos mesmos limites
// half-open sobre a data do apontamento. O backend escreve o motivo em `:1428-1434`:
// *"deixá-las all-time faria a linha de janeiro exibir horas de fevereiro e a soma dos 3
// baldes deixaria de fechar com `totalSeconds`."*
//
// O sufixo "(chamado)" do cabeçalho FICA: ele diz de quem é a soma (deste chamado), e continua
// necessário porque as três colunas repartem a mesma janela em três destinos de cobrança.

const SUFIXO_BALDE =
  'Soma dos apontamentos concluídos deste chamado dentro do período filtrado, repartida por como cada hora é cobrada.'

export const HEADER_BALDE_PLANO = 'Plano (chamado)'
export const TOOLTIP_BALDE_PLANO = `Horas que consomem o plano de suporte. ${SUFIXO_BALDE}`

export const HEADER_BALDE_FATURADO = 'Cobrado por fora (chamado)'
export const TOOLTIP_BALDE_FATURADO = `Horas marcadas para cobrar fora do plano. ${SUFIXO_BALDE}`

export const HEADER_BALDE_ANALISE = 'Análise (chamado)'
export const TOOLTIP_BALDE_ANALISE = `Horas isentas de cobrança, em chamado de análise interna. ${SUFIXO_BALDE}`

// ── Filtro "somente o que entra na fatura" ────────────────────────────────────
//
// Liga o parâmetro `apenasFatura` de `GET /reports/tickets`
// (predicado em `ReportQueryRepository.cs:1257-1264`, aplicado ANTES do `CountAsync` — a
// paginação acompanha o recorte).
//
// 🔴 **132/D1 — o predicado trocou de pergunta.** Era "o chamado foi concluído dentro do
// período"; virou "a soma dos apontamentos ativos e concluídos do chamado dentro da janela é
// maior que zero" (`Sum(...) > 0`, nunca `Any(...)` — 132/BE-D1, para não divergir de
// `entraNaFatura` no apontamento de `TotalSegundos = 0`). Consequência que o texto TEM de
// dizer: **chamado em aberto com hora no período agora PASSA pelo filtro** — antes era
// exatamente o que ele excluía.
//
// ⚠️ Nasce DESLIGADO de propósito: o padrão da tela é mostrar também os chamados em aberto,
// que é instrução explícita do usuário no documento de QA da 121
// (`121-qa-rodada3-pendentes/fonte-documento-qa.md:30`). Ligá-lo por padrão mudaria o
// conjunto de linhas sem decisão de produto (DP-7).

export const TEXTO_APENAS_FATURA_LABEL = 'Só o que entra na fatura do período'

export const TEXTO_APENAS_FATURA_INFO =
  'Desligado, a lista mostra também os chamados sem nenhuma hora apontada no período — é a visão de conferência. Ligado, ficam só os chamados com horas apontadas no período, que são os que entram nesta fatura; chamado em aberto entra igual, se tiver hora no período.'

// ── 123/FE-PER (D-2) — o período do detalhe do parceiro, dito em voz alta ─────
//
// A tela passou a ter UM período só, resolvido no painel (`shared/utils/periodoPadrao.ts`,
// que traz a justificativa completa e as âncoras de backend). O texto abaixo existe porque
// **default invisível é defeito de comunicação**: se a tela cai no mês atual sem dizer, quem
// olha conclui que os números estão errados — que é literalmente o relato que originou a D-2.
//
// Não afirma prazo, limite nem periodicidade: só imprime as duas datas que a tela mandou ao
// backend (AP-FRONTEND-022).

/*
 * 🔴 **132/F2 (D7) — `KPI_EM_ABERTO_LABEL` e `KPI_EM_ABERTO_TEXTO` foram REMOVIDAS daqui.**
 *
 * Elas eram o rótulo e o subtexto do cartão "Em aberto (não faturável ainda)" do painel do
 * parceiro, e diziam *"Total, independe do período — trabalho em chamados ainda sem data de
 * conclusão."*. O campo que as alimentava (`horasEmAbertoNaoFaturadas`) **saiu do wire** de
 * `/metrics/plan-consumption` na 132/B1+B2, e o cartão saiu de `ClientTicketsPanel.tsx` na
 * 132/F2. Com `TimeEntry.InicioEm` como competência (132/D1), a hora é faturada no mês em
 * que foi APONTADA — chamado aberto ou fechado —, logo não existe mais "trabalho em aberto
 * fora de qualquer fatura": o conceito acabou, não só o cartão.
 *
 * ⚠️ **Elas eram citadas por `textoPeriodoDoDetalhe`, e é isso que torna esta remoção parte
 * da F2 e não da F3.** Aquela frase interpolava `KPI_EM_ABERTO_LABEL` **de propósito**
 * (decisão de 123/FE-FIX3, ressalva `F-2`): o cartão era a **exceção** de "a tabela e os
 * cartões abaixo usam este mesmo período", e interpolar em vez de digitar garantia que
 * renomear o cartão reescrevesse a exceção junto. O mecanismo funcionou como projetado —
 * ao remover o cartão, o acoplamento **apontou** para a frase que ficaria falsa. A exceção
 * saiu da frase no mesmo commit; ver a nota dentro de `textoPeriodoDoDetalhe`.
 *
 * Recorte desta unidade: **só** estas 2 constantes e aquela cláusula. Os demais textos de
 * competência deste arquivo (os que ainda dizem "concluído") são da **132/F3**, que roda
 * depois — `analise-frontend.md` §6.1 e a ordem de §12.2.
 */

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
  // 🔴 132/F2 (D7) — a frase terminava com a exceção
  // `— menos o cartão "${KPI_EM_ABERTO_LABEL}", que é um total acumulado.`
  // O cartão foi removido (ver a nota acima, onde as constantes viviam), então a exceção
  // deixou de ter sujeito: mantê-la faria a tela apontar para um cartão que o usuário não
  // encontra. Agora a afirmação é a simples, e ela é VERDADEIRA — todos os cartões da
  // grade e a tabela usam o mesmo período. Não é afrouxamento do texto: é o texto voltando
  // a ser o que era antes de 123/FE-FIX3 abrir a exceção, porque a exceção acabou.
  const base =
    `Período em uso: ${formatarDiaLocal(efetivo.from)} a ${formatarDiaLocal(efetivo.to)}. ` +
    `A tabela e os cartões abaixo usam este mesmo período.`

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
// concluir daí que "agora os números batem" erra.
//
// 🔴 132/D1 + D11 (09/09/2026) — E AGORA A SEGUNDA CAUSA, A DATA, TAMBÉM ACABOU.
//
// Medido na fonte hoje, com B1/B2 entregues, e o resultado obriga a reescrever as duas
// frases inteiras:
//
//  · **a data DEIXOU de ser razão.** Os dois lados recortam por `te.InicioEm`:
//    `plan-health` sempre recortou (`MetricsQueryRepository.cs:1465-1474`) e
//    `plan-consumption` passou a recortar (região `⟪131 PLANCONSUMO-HORASUSADAS⟫`,
//    `ReportQueryRepository.cs:900-914`). Mais que isso: os DOIS predicados são hoje
//    literalmente os mesmos — `Status == Completed`, `DesativadoEm == null`,
//    `Categoria != Invoicy`, `!FatureiFora`, ticket-only, mesma janela half-open. Uma
//    frase que ainda dissesse "conta pela data em que o chamado foi concluído" nomearia
//    uma diferença inexistente e mandaria o usuário procurar o erro no lugar errado.
//
//  · 🔴 **a razão NOVA é o CRÉDITO DE HORAS (132/R-12).** `plan-consumption` conta o plano
//    **efetivo** (contrato + crédito da competência, `ReportQueryRepository.cs:1006-1043`);
//    `plan-health` conta só o **contratado** (`HorasContratadas = HorasOverride ?? HorasMes`,
//    `MetricsQueryRepository.cs:1464`) e **não conhece crédito nem snapshot** — foi decisão
//    explícita do Manager mantê-lo fora do escopo da 132. O próprio backend registra a
//    consequência no XML-doc de `PlanHealthItemDto` (`MetricsDtos.cs:137-148`): *"para
//    cliente com crédito na competência, `percentualConsumo` daqui diverge de
//    `percentualPlano` de `/metrics/plan-consumption`; para cliente sem crédito os dois
//    números são idênticos"*, com teste de requisição consultando os DOIS endpoints.
//
//  · **quem entra na lista — a razão que nenhum texto jamais mencionou, e que PERMANECE**:
//    `plan-health` só considera cliente COM plano (`c.SupportPlanId != null`,
//    `MetricsQueryRepository.cs:1459`), enquanto `plan-consumption` também lista cliente
//    SEM plano que teve consumo real no período (`ReportQueryRepository.cs:819-831`).
//
//  · **as horas de projeto, que SAÍRAM na 131**: continua valendo, e os textos seguem
//    dizendo na afirmativa — "nenhum dos dois conta projeto no plano".
//
// ⚠️ Por isso nenhum dos dois textos volta a FECHAR a enumeração num número ("por essas
// duas razões"). Fechar é afirmar que a lista é completa, e ela não é: além das acima, o
// `plan-consumption` ainda estreita por equipe para o perfil atendente, enquanto o
// `plan-health` é sempre global (`MetricsQueryRepository.cs:1454`). Foi exatamente um
// número fechado — "duas razões" — que ficou falso quando uma das razões sumiu, e agora
// sumiu a segunda: em dois meses, duas das causas enumeradas deixaram de existir.
//
// ⚠️ **O que estes textos NÃO dizem, de propósito:** que esta tela pode exibir um snapshot
// de mês fechado (D12). O envelope `fonte` ainda não chega no wire de
// `/metrics/plan-consumption` (é 132/B11, não entregue), e afirmar aqui um comportamento
// que a tela ainda não tem seria inverter o defeito que esta unidade existe para corrigir.
// Quando o selo de mês fechado entrar, é aqui que a razão nova é acrescentada.

/**
 * Rótulo curto do card Saúde dos Planos — fica visível em todos os estados.
 *
 * ⚠️ 132/F3 — continua VERDADEIRO (o medidor é ao vivo e conta pelo lançamento), mas deixou
 * de **distinguir**: a outra tela também conta pelo lançamento. Quem distingue agora é
 * `TEXTO_SAUDE_PLANOS_COMPARACAO`. Mantido por isso, e não por inércia.
 */
export const TEXTO_SAUDE_PLANOS_ROTULO =
  'Medidor ao vivo: a hora entra no mês em que o time a lançou.'

/** Por que este número pode não bater com o do relatório de fatura. */
export const TEXTO_SAUDE_PLANOS_COMPARACAO =
  `O relatório Consumo de Planos conta as horas pela mesma data deste medidor — a do apontamento —, mas mede o plano da competência com o ${ROTULO_CREDITO_PUBLICO} somado, quando há, e lista também cliente sem plano contratado; este medidor usa só as horas contratadas e mostra só quem tem plano. Por diferenças como essas, os dois podem mostrar números diferentes no mesmo mês — e os dois estão certos. Hora de projeto não consome plano em nenhum dos dois: projeto é contratado à parte, e continua registrado e faturável.`

/** O irmão da frase acima, na tela de Consumo de Planos (mesma explicação, outro lado). */
export const TEXTO_COMPETENCIA_VS_SAUDE_PLANOS =
  `O gráfico Saúde dos Planos, no painel, conta as horas pela mesma data desta tela — a do apontamento —, mas mede só as horas contratadas do plano, sem o ${ROTULO_CREDITO_PUBLICO}, e mostra só clientes com plano contratado; esta tela soma o crédito da competência ao plano e lista também cliente sem plano que teve consumo. Por diferenças como essas, ele pode mostrar um número diferente do desta tela no mesmo mês — e os dois estão certos. Nenhum dos dois conta hora de projeto no plano.`
