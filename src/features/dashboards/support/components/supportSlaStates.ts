/**
 * 124/F4 — os dois estados vazios do SLA de 1ª resposta e o limite de confiabilidade
 * do FCR (`R-3`), como lógica PURA.
 *
 * ## Por que este arquivo existe (e não vive dentro do componente)
 *
 * 1. `react-refresh/only-export-components` reprova exportar função de um módulo que
 *    exporta componente (mesmo motivo de `support-plans/utils/unmatchedTexts.ts`);
 * 2. a decisão "este `null` é *não configurado* ou é *não há chamado no período*" é a
 *    própria entrega desta unidade — ela merece teste unitário além do teste de
 *    componente, nunca no lugar dele (`rules/tests.md` § o sujeito da frase).
 *
 * ## O que o backend responde (fonte: `be-f4f5-report.md` §3, medido lá, não presumido)
 *
 * `respondidosNoPrazo` e `respondidosForaDoPrazo` saem **os dois `null`** quando o
 * conjunto de chamados ELEGÍVEIS do período é vazio — nunca `0`. São **7** os caminhos
 * que esvaziam esse conjunto:
 *
 * | # | Situação                                                            |
 * |---|---------------------------------------------------------------------|
 * | 1 | nenhum calendário cadastrado (tabelas vazias — o dia 1, `AUTO-124-8`) |
 * | 2 | nenhum calendário `padrao` e o plano não aponta calendário            |
 * | 3 | calendário existe mas **sem nenhuma janela** de expediente            |
 * | 4 | `plano.slaIsento == true`                                            |
 * | 5 | meta nula no plano **e** no calendário                               |
 * | 6 | meta `<= 0` (configuração inválida, tratada como não configurada)     |
 * | 7 | chamado sem apontamento elegível (ninguém atendeu ainda)              |
 *
 * Os 7 são indistinguíveis entre si no wire — e nenhum deles é "não há chamado no
 * período". Por isso a tela precisa de um DISCRIMINADOR externo para não afirmar
 * "não configurado" quando o período simplesmente não tem chamado.
 *
 * ## O discriminador — e por que ele é rigoroso, não palpite
 *
 * `chamadosNoPeriodo` é o `ticketsAbertos` do MESMO `GET /metrics/overview`. Conferido
 * no código do backend (não deduzido do nome):
 *
 * - `MetricsQueryRepository.GetOverviewRawCoreAsync` conta `ticketsAbertos` sobre
 *   `Tickets` ativos, com o escopo de equipe/cliente aplicado, filtrando
 *   `HsCriadoEm >= from && HsCriadoEm < toExclusive`;
 * - `MetricsQueryRepository.GetSlaSourceAsync` monta o universo do SLA com
 *   `ComEscopoDeTickets(...)` sobre `Tickets` ativos e **o mesmo** recorte
 *   `HsCriadoEm >= from && HsCriadoEm < toExclusive` (`R-4`).
 *
 * Nenhum dos dois aplica `supportPlanId` (ele só filtra apontamentos). Logo
 * `chamadosNoPeriodo` é **exatamente a cardinalidade do universo de elegibilidade** do
 * SLA: `chamadosNoPeriodo == 0` ⇒ o `null` é mecânico (não há o que medir);
 * `chamadosNoPeriodo > 0` ⇒ havia chamado e nenhum entrou — a causa está na
 * configuração/elegibilidade (um dos 7 caminhos).
 *
 * ⚠️ **Acoplamento declarado:** se um dos dois recortes mudar no backend, este
 * discriminador degrada em silêncio. `supportSlaStates.test.ts` documenta a premissa;
 * quem mexer em qualquer um dos dois recortes tem de revisitar este arquivo.
 */

import { dataCurta, diaLocalSaoPaulo } from '../../../business-calendar/utils/localDay'

/* ────────────────────────────────────────────────────────────────────────────────────
 * Estado do SLA de 1ª resposta
 * ──────────────────────────────────────────────────────────────────────────────────── */

/**
 * O que a tela sabe sobre o SLA do período. União discriminada de propósito: cada
 * variante tem texto próprio, e "não configurado" carrega o número que o sustenta
 * (`AP-FRONTEND-022` — texto que afirma comportamento vem com a âncora ao lado).
 */
export type EstadoDoSla =
  | { tipo: 'ok'; noPrazo: number; foraDoPrazo: number }
  | { tipo: 'nao-configurado'; chamadosNoPeriodo: number }
  | { tipo: 'sem-chamados' }
  | { tipo: 'indeterminado' }

export type EntradaDoEstadoDoSla = {
  respondidosNoPrazo: number | null
  respondidosForaDoPrazo: number | null
  /** `ticketsAbertos` do mesmo overview. `null`/`undefined` = ainda não sei. */
  chamadosNoPeriodo?: number | null
}

/**
 * Classifica o SLA do período.
 *
 * Guardas com `== null` (nunca `=== undefined`): os três campos atravessam a rede e
 * `null` e ausência são o mesmo fato para quem consome (`AP-FRONTEND-028`).
 *
 * `indeterminado` existe para NÃO afirmar: sem o discriminador, dizer "não configurado"
 * seria inventar a causa, e dizer "sem chamados" seria inventar o dado.
 */
export function estadoDoSla({
  respondidosNoPrazo,
  respondidosForaDoPrazo,
  chamadosNoPeriodo,
}: EntradaDoEstadoDoSla): EstadoDoSla {
  if (respondidosNoPrazo != null && respondidosForaDoPrazo != null) {
    return { tipo: 'ok', noPrazo: respondidosNoPrazo, foraDoPrazo: respondidosForaDoPrazo }
  }
  if (chamadosNoPeriodo == null) return { tipo: 'indeterminado' }
  if (chamadosNoPeriodo <= 0) return { tipo: 'sem-chamados' }
  return { tipo: 'nao-configurado', chamadosNoPeriodo }
}

/** Título do estado vazio "ainda não foi configurado" — as palavras exigidas pela unidade. */
export const TITULO_SLA_NAO_CONFIGURADO = 'SLA de 1ª resposta não configurado'

/** Título do estado vazio "o período não tem chamado" — nunca colapsado com o de cima. */
export const TITULO_SLA_SEM_CHAMADOS = 'Nenhum chamado criado no período selecionado'

/** Título do estado em que a tela não sabe qual dos dois é — não afirma nenhum. */
export const TITULO_SLA_INDETERMINADO = 'SLA de 1ª resposta sem apuração para o período'

/**
 * 124/FE-TXT — A FRASE ÚNICA da pré-condição do cálculo. Um fato, um texto.
 *
 * Ela é reproduzida **literalmente** no estado vazio do gráfico compartilhado
 * (`dashboards/shared/components/FirstResponseVsSlaChart.tsx`), que não pode importar
 * daqui sem inverter a direção da dependência (`shared/` passando a depender de uma
 * feature). Há teste de componente que compara **as duas fontes reais** e reprova se
 * divergirem — a cópia não é mantida no olho.
 *
 * ## A precedência da meta, conferida no backend (não no relatório de ninguém)
 *
 * `MetricsService.cs:691` → `var meta = fonte.PlanoSlaMinutos ?? metaDoCalendario;`
 * `ICalendarioProvider.cs:36-43` documenta `calendarios.slapadraominutos` como
 * *"a herança de `plano.SlaPrimeiroAtendimentoMinutos ?? calendario.SlaPadraoMinutos`"*.
 *
 * Ou seja: **a meta do plano tem precedência, e a do calendário é o padrão que vale na
 * falta dela.** Quem preencheu só a meta padrão do calendário está **corretamente
 * configurado** — o texto anterior (*"exige a meta de 1ª resposta no plano do cliente"*)
 * mandaria essa pessoa preencher plano a plano à toa. Incompleto de um jeito que produz
 * trabalho desnecessário é a mesma classe de defeito que esta demanda fecha.
 *
 * O calendário aplicável é o do plano (`fonte.PlanoCalendarioId`) ou o marcado como padrão
 * (`MetricsService.cs:663-681`); o expediente vazio derruba a apuração antes da meta
 * (`:686`, a guarda que a mutação M5 de `BE-F4F5` revelou).
 */
export const PRE_CONDICAO_DO_CALCULO_DO_SLA =
  'O cálculo exige um calendário com expediente cadastrado e uma meta de 1ª resposta — ' +
  'do plano do cliente ou, na falta dela, a meta padrão do calendário.'

/**
 * A explicação do "não configurado".
 *
 * Enumera as condições REAIS (os 7 caminhos do §3 do `be-f4f5-report.md`) em vez de
 * eleger uma causa: o wire não distingue qual delas ocorreu, e escolher uma seria
 * afirmar o que não se sabe.
 */
export function detalheSlaNaoConfigurado(chamadosNoPeriodo: number): string {
  const chamados =
    chamadosNoPeriodo === 1
      ? 'O único chamado criado no período não entrou'
      : `Nenhum dos ${new Intl.NumberFormat('pt-BR').format(chamadosNoPeriodo)} chamados criados no período entrou`
  return (
    `${chamados} na apuração. ${PRE_CONDICAO_DO_CALCULO_DO_SLA} Chamado de plano isento ` +
    'de SLA ou ainda sem primeiro atendimento também fica de fora.'
  )
}

/** Explicação do vazio por filtro — nenhuma menção a configuração, que não é o caso. */
export const DETALHE_SLA_SEM_CHAMADOS =
  'Sem chamado criado no período, não há SLA de 1ª resposta para apurar. ' +
  'Ajuste o período ou os filtros.'

/** Explicação do indeterminado: descreve o que se sabe, e só. */
export const DETALHE_SLA_INDETERMINADO =
  'O período não devolveu números de SLA e a contagem de chamados não chegou — ' +
  'não é possível dizer se falta configuração ou se falta chamado no período.'

/**
 * Chamada de ação para quem PODE configurar (mesmo gate da Sidebar: `isGestor`).
 *
 * 124/FE-TXT — parte 1 de 2, com o link para **Calendário** entre elas. Antes era
 * *"Cadastre a meta de 1ª resposta em [Planos] e o expediente em [Calendário]"*, que
 * mandava ao plano quem já tinha a meta padrão do calendário preenchida — configuração
 * válida por `MetricsService.cs:691`. Agora o expediente (que **só** existe no calendário)
 * vem primeiro, e a meta é apresentada com as suas duas moradas possíveis.
 */
export const ACAO_SLA_NAO_CONFIGURADO = 'Cadastre o expediente em'

/**
 * Parte 2 de 2 — vai entre o link de **Calendário** e o de **Planos**. Um link por tela:
 * repetir o link do calendário para citar a meta padrão faria a mesma porta aparecer duas
 * vezes na mesma frase.
 */
export const ACAO_SLA_NAO_CONFIGURADO_META =
  '. A meta de 1ª resposta pode ser a padrão do próprio calendário ou, por cliente, a do plano em'

/** Chamada de ação para quem não tem acesso às telas de configuração. */
export const ACAO_SLA_NAO_CONFIGURADO_SEM_ACESSO =
  'Peça a um gestor para cadastrar o expediente do calendário e uma meta de 1ª resposta — ' +
  'a padrão do calendário ou a do plano do cliente.'

/* ────────────────────────────────────────────────────────────────────────────────────
 * R-3 — o limite de confiabilidade do FCR
 * ──────────────────────────────────────────────────────────────────────────────────── */

/** O que o aviso precisa dizer: o dia (SP) em que o histórico de movimentação começa. */
export type AvisoDeHistoricoDoFcr = {
  /** Dia civil de São Paulo do `fcrHistoricoDesde`, `AAAA-MM-DD`. */
  limiteDia: string
  /** O mesmo dia em `DD/MM/AAAA`, que é como o aviso o mostra. */
  limiteFormatado: string
  /** Início efetivo do período consultado, `AAAA-MM-DD` — o outro lado da comparação. */
  inicioDoPeriodo: string
}

export type EntradaDoAvisoDeHistoricoDoFcr = {
  /** O número do FCR. Sem número não há o que qualificar. */
  fcr?: number | null
  /** `MIN(ticketstatushistory.mudouem)` em ISO-8601 UTC. AUSENTE do JSON quando null. */
  fcrHistoricoDesde?: string | null
  /** `from` do filtro, `AAAA-MM-DD`. `null` = o default do backend (mês corrente SP). */
  periodoInicio?: string | null
  /** Hoje em SP — injetável para teste. */
  hoje?: string
}

/**
 * Primeiro dia do mês de um dia `AAAA-MM-DD`, puramente textual (sem `Date`, sem fuso).
 *
 * Espelha o default do backend: `FusoSaoPaulo.Resolver` usa
 * `new DateOnly(hojeLocal.Year, hojeLocal.Month, 1)` quando `from` é ausente. Período
 * sem `from` **não** é período aberto — é o mês corrente.
 */
export function inicioEfetivoDoPeriodo(
  periodoInicio?: string | null,
  hoje: string = diaLocalSaoPaulo(),
): string {
  if (periodoInicio != null && /^\d{4}-\d{2}-\d{2}$/.test(periodoInicio)) return periodoInicio
  return `${hoje.slice(0, 7)}-01`
}

/**
 * O aviso de `R-3`, ou `null` quando não há o que avisar.
 *
 * Dispara quando **o período consultado começa antes do limite** — a regra da §4 do
 * `be-f4f5-report.md`. Três recusas antes dela, todas do próprio relatório:
 *
 * - `fcr == null` → não há número para qualificar (o vazio do FCR é outro assunto);
 * - `fcrHistoricoDesde` ausente → não há histórico algum, situação transitória: o
 *   relatório manda mostrar o número **sem** selo;
 * - data ilegível → não inventar limite.
 *
 * **A comparação é `<=` no DIA, e isso é deliberado.** A regra do relatório é sobre
 * INSTANTES (`início do período < fcrHistoricoDesde`). O início do período é 00:00 SP
 * do dia inicial; o limite é um instante qualquer do dia `limiteDia`. Então
 * `inícioUtc < limite` ⟺ `inicio < limiteDia` **ou** (`inicio == limiteDia` e o limite
 * não é exatamente 00:00). Comparar `<=` no dia implementa a regra de instante em todos
 * os casos, exceto o limite exatamente à meia-noite — em que avisa um dia a mais. Errar
 * para o lado de avisar é o lado certo: o indicador é **sistematicamente otimista**.
 */
export function avisoDeHistoricoDoFcr({
  fcr,
  fcrHistoricoDesde,
  periodoInicio,
  hoje = diaLocalSaoPaulo(),
}: EntradaDoAvisoDeHistoricoDoFcr): AvisoDeHistoricoDoFcr | null {
  if (fcr == null) return null
  if (fcrHistoricoDesde == null || fcrHistoricoDesde === '') return null

  const instante = new Date(fcrHistoricoDesde)
  if (Number.isNaN(instante.getTime())) return null

  const limiteDia = diaLocalSaoPaulo(instante)
  const inicioDoPeriodo = inicioEfetivoDoPeriodo(periodoInicio, hoje)
  if (inicioDoPeriodo > limiteDia) return null

  return { limiteDia, limiteFormatado: dataCurta(limiteDia), inicioDoPeriodo }
}

/** Cabeçalho do aviso — nomeia o indicador, porque ele não é o do card. */
export const TITULO_AVISO_FCR = 'FCR (1º contato): número superestimado neste período'

/**
 * O corpo do aviso. Conteúdo mínimo definido pela §4 do `be-f4f5-report.md`.
 *
 * A data NUNCA é digitada: vem de `fcrHistoricoDesde`, o mesmo campo que o backend
 * calcula (`AP-FRONTEND-022` — número que aparece na tela vem da fonte, nunca da prosa).
 */
export function textoDoAvisoDeHistoricoDoFcr(limiteFormatado: string): string {
  return (
    `O histórico de movimentação começa em ${limiteFormatado}. Chamados anteriores a essa ` +
    'data aparecem como resolvidos no primeiro contato por falta de registro — o indicador ' +
    'está superestimado para este período.'
  )
}
