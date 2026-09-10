/**
 * 132/F4d (D12 · C-6 · C-7 · D20) — **de onde vêm os números desta tela**, dito em voz alta.
 *
 * ─── 🔴 A REGRA ESTRUTURAL DESTE ARQUIVO ────────────────────────────────────────────────────
 *
 * **A fonte vem no payload. O front NUNCA a infere pela data.** `arquitetura.md` §9.2. Por isso
 * este módulo **não recebe datas** — só o envelope. Não é disciplina: é desenho. Sem `from`/`to`
 * na assinatura, a inferência fica **impossível de escrever por engano** aqui, e o teste
 * estrutural (`fonteDoPeriodo.estrutural.test.ts`) varre a AST deste arquivo e do componente
 * proibindo `new Date`, `Date.now`, `filters.from`, `filters.to` e `defaultCurrentMonth`.
 *
 * O motivo é de negócio, não de estilo: só o backend sabe se **existe snapshot** para a
 * competência. Um front que decidisse "agosto já passou, logo é mês fechado" afirmaria "estes
 * são os números que foram faturados" sobre um cálculo ao vivo — e erraria justamente no mês
 * reaberto, que é o caso em que alguém está conferindo dinheiro.
 *
 * ─── Fail-closed: `'desconhecida'`, nunca um dos dois ───────────────────────────────────────
 *
 * `normalizarFonte` devolve `'desconhecida'` para ausência, `null` e qualquer token que não
 * esteja em `FONTES_DO_CONSUMO`. **Não é `'aovivo'` por conveniência**: tratar desconhecido
 * como "ao vivo" afirmaria que o número é atual num mês que pode estar congelado; como
 * "snapshot", afirmaria que é o que foi cobrado. `'desconhecida'` **não exibe selo nenhum** — a
 * tela fica exatamente como hoje, que é a única afirmação verdadeira quando não se sabe. E é o
 * mesmo ramo do backend anterior à 132, de propósito: os dois casos são "não sei".
 *
 * ─── AP-API-002: texto anexado a uma FAMÍLIA de status ──────────────────────────────────────
 *
 * A frase de "ao vivo" cobre hoje **três** estados de competência (`Corrente`, `Aberta`,
 * `Reaberta` — `analise-backend.md:195`, o enum tem sete membros) e amanhã pode cobrir um
 * quarto. Por isso ela **não** diz "esta competência ainda não foi fechada" (falso para
 * `Reaberta`, que já foi) nem "mês corrente" (falso para `Reaberta` e `Aberta`). Ela diz o que é
 * verdade para todos: *em aberto agora, calculado agora, sujeito a mudança*.
 *
 * 🟠 **Incerteza declarada, herdada da análise (§4.3):** o envelope **não distingue**
 * `Reaberta` de `Corrente` — não há campo `estado` na resposta de `/metrics/plan-consumption`.
 * `arquitetura.md:502` promete *"a tela volta ao ao vivo com selo 'competência reaberta'"*, e
 * **não há campo no payload que permita isso**. `competenciaVersao > 1` indica **refechamento**,
 * não reabertura. Implementado **sem** o selo de reaberta, com o ponto de extensão pronto: se o
 * backend acrescentar `estado`, é aqui que ele entra. Inventá-lo por inferência seria
 * exatamente o defeito que o parágrafo de cima proíbe.
 */

import { FONTES_DO_CONSUMO } from '../shared/types/reports'
import type { FonteDoConsumo, PlanConsumptionResponseDto } from '../shared/types/reports'

/** O que o front consegue afirmar sobre a origem dos números. */
export type FonteNormalizada = FonteDoConsumo | 'desconhecida'

/**
 * `fonte` do wire → vocabulário fechado, fail-closed.
 *
 * ⚠️ Recebe `string | null | undefined` porque é o que o servidor controla (AP-API-002) — e é
 * justamente a entrada inesperada que esta função existe para conter.
 */
export function normalizarFonte(bruto: string | null | undefined): FonteNormalizada {
  if (bruto == null) return 'desconhecida'

  const conhecida = (FONTES_DO_CONSUMO as readonly string[]).includes(bruto)
  if (conhecida) return bruto as FonteDoConsumo

  if (import.meta.env.DEV) {
    // Em DEV o token novo aparece para quem o pode corrigir; em produção a tela apenas não
    // afirma nada. Nenhum dado de usuário aqui (`rules/security.md` § Logs).
    console.error(
      `[fonte do consumo] token desconhecido no wire: "${bruto}". ` +
        'Tratado como desconhecida (nenhum selo exibido).',
    )
  }
  return 'desconhecida'
}

/** O estado de exibição — um só, resolvido por precedência declarada. */
export type EstadoDoPeriodo =
  | 'fechada'
  | 'aovivo'
  | 'periodo-personalizado'
  | 'anterior-ao-congelamento'
  | 'desconhecida'

/**
 * Precedência, e por que ela é esta:
 *
 *  1. **`avisoPeriodoNaoMensal`** vem primeiro porque é o aviso que explica o **crédito zerado**
 *     (D20, fail-closed sem rateio): sem ele, um recorte de 45 dias mostraria o plano sem
 *     crédito e o usuário concluiria que o crédito sumiu;
 *  2. **`avisoAnteriorAoCongelamento`** vem depois porque é o único que fala do **passado
 *     pré-deploy** (C-6, sem backfill) — números recalculados pela regra de hoje;
 *  3. `snapshot` e `aovivo` são o caso normal;
 *  4. `desconhecida` não exibe nada.
 *
 * ⚠️ Os dois avisos podem chegar junto com `fonte = 'aovivo'` — C-7 força o modo ao vivo. O que
 * NÃO pode acontecer é aviso junto com `snapshot`, e a precedência acima faz o aviso ganhar de
 * propósito: se o backend mandar essa combinação impossível, a tela mostra o aviso (afirmação
 * mais fraca) em vez de afirmar "foi isto que foi faturado".
 */
export function derivarEstadoDoPeriodo(
  envelope: Pick<
    PlanConsumptionResponseDto,
    'fonte' | 'avisoPeriodoNaoMensal' | 'avisoAnteriorAoCongelamento'
  >,
): EstadoDoPeriodo {
  if (envelope.avisoPeriodoNaoMensal === true) return 'periodo-personalizado'
  if (envelope.avisoAnteriorAoCongelamento === true) return 'anterior-ao-congelamento'

  const fonte = normalizarFonte(envelope.fonte)
  if (fonte === 'snapshot') return 'fechada'
  if (fonte === 'aovivo') return 'aovivo'
  return 'desconhecida'
}

// ── Os textos, cada um com a âncora da afirmação ────────────────────────────────────────────

/** Título acessível da região — informativa, não interativa. */
export const ROTULO_REGIAO_FONTE = 'Origem dos números desta tela'

/**
 * Glifo do selo de mês fechado. **Sempre acompanhado de texto** (WCAG 1.4.1) — nunca é ele que
 * carrega a informação.
 */
export const GLIFO_FECHADA = '🔒'

/** Rótulo curto do selo, ao lado do glifo. */
export const SELO_FECHADA = 'Competência fechada'

/**
 * D12 / PRD §4.4 · `arquitetura.md:636-639` — mês fechado exibe o **snapshot**: o que foi
 * faturado, que não muda com recálculo.
 *
 * `mes` e `fechadaEm` já chegam formatados pelo componente (é ele que tem o formatador de data
 * do projeto). ⚠️ Nenhum prazo nem periodicidade digitados (AP-FRONTEND-022).
 */
export function textoFechada(mes: string, fechadaEm: string | null): string {
  const quando = fechadaEm ? ` em ${fechadaEm}` : ''
  return (
    `Competência ${mes} fechada${quando}. ` +
    'Os números abaixo são os que foram faturados — não mudam com recálculo.'
  )
}

/**
 * `arquitetura.md:638` — competência em aberto.
 *
 * ⚠️ **Verdadeiro para os três estados que hoje caem aqui** (`Corrente`, `Aberta`, `Reaberta`) e
 * para um quarto que venha depois: por isso não diz "ainda não foi fechada" nem "mês corrente".
 */
export function textoAoVivo(mes: string): string {
  return (
    `Competência ${mes} em aberto: ` +
    'números calculados agora e sujeitos a mudança até o fechamento.'
  )
}

/**
 * C-7, **verbatim do despacho** — período que não é uma competência civil.
 *
 * É este texto que explica o crédito **zerado** de D20: em recorte não-mensal não há
 * competência a consultar, e ratear crédito por 45 dias seria número inventado.
 */
export const TEXTO_PERIODO_PERSONALIZADO =
  'Período personalizado: números calculados ao vivo, podem divergir do que foi faturado.'

/**
 * C-6 (`arquitetura.md:43-44`) — sem backfill: competência anterior ao início do congelamento é
 * recalculada pela regra **atual**, que pode não ser a que gerou a fatura da época.
 */
export const TEXTO_ANTERIOR_AO_CONGELAMENTO =
  'Competência anterior ao início do congelamento — números recalculados pela regra atual, que pode não ser a que gerou a fatura da época.'

/**
 * D20 — a frase que liga o aviso ao **crédito**. Fica junto do aviso de período personalizado,
 * porque é ali que o crédito é zero.
 */
export const TEXTO_CREDITO_ZERADO_NAO_MENSAL =
  'Crédito de horas não é considerado em período personalizado: ele vale por competência inteira e não é dividido.'

/** Rótulo do botão que leva à comparação snapshot × ao vivo (D12, só `GerentePlus`). */
export const ROTULO_COMPARAR = 'Comparar com o cálculo atual'

/**
 * C-8 — refechamento. `competenciaVersao > 1` significa que a competência foi fechada mais de
 * uma vez; **não** significa que ela está reaberta agora (o envelope não tem esse campo — ver o
 * docblock do topo).
 */
export function textoRefechada(versao: number): string {
  return `Fechada ${versao} vezes — a última contagem é a que vale.`
}
