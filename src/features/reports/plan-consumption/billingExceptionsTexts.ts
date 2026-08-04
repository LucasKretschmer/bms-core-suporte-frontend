/**
 * 121/A2 + F-15 — textos do card e do modal de exceções de faturamento.
 *
 * Ficam num módulo próprio porque **texto de UI que afirma comportamento do sistema
 * é código, não copy** (AP-FRONTEND-022): "sem data de conclusão", "entra na próxima
 * fatura", "não exige ação", "com apontamento no período" são asserções verificáveis
 * sobre o que a query faz. Centralizadas, são testáveis e mudam junto com a regra.
 *
 * Ancoragem de cada afirmação (§5.1/§5.2 da arquitetura da 121 + decisão F-15):
 *  - seção `anomalia`:   `PipelineStage.Fechado == true ∧ Ticket.FechadoEm == null`;
 *  - seção `postergado`: `PipelineStage.Fechado == false ∧ Ticket.FechadoEm == null`;
 *  - `from`/`to` NÃO filtram data de conclusão (ela é nula por definição nas duas):
 *    filtram por EXISTÊNCIA de apontamento `Completed` ativo com `InicioEm` na janela;
 *  - ausentes ⇒ nenhum recorte.
 * Nenhum prazo, limite ou periodicidade é afirmado — não há número digitado aqui.
 */

import { format, parseISO } from 'date-fns'
import type { BillingExceptionTipo } from '../shared/types/reports'

/** Título do card/modal. */
export const TEXTO_EXCECOES_TITULO = 'Exceções de faturamento'

/** Rótulo do botão que abre o modal. */
export const TEXTO_EXCECOES_ACAO = 'Conferir'

/** Rótulo curto de cada seção (aba do modal e prefixo das linhas do card). */
export const TEXTO_SECAO_ROTULO: Record<BillingExceptionTipo, string> = {
  anomalia: 'Precisa ação',
  postergado: 'Postergado',
}

/** O que cada seção É, e — para `postergado` — que ela NÃO pede nada de ninguém. */
export const TEXTO_SECAO_DEFINICAO: Record<BillingExceptionTipo, string> = {
  anomalia:
    'Chamados em estágio fechado e sem data de conclusão: as horas deles ficam fora de qualquer fatura até a data ser preenchida. Exige conferência.',
  postergado:
    'Chamados ainda abertos: as horas deles saíram desta fatura e entram na fatura da competência em que o chamado for concluído. Não exige ação.',
}

type RecorteArgs = {
  from: string | null
  to: string | null
  ignorarPeriodo?: boolean
}

/** "YYYY-MM-DD" → "dd/MM/yyyy" em fuso LOCAL (nunca `new Date(iso)` + UTC: off-by-one). */
function formatarDiaLocal(dia: string): string {
  try {
    return format(parseISO(dia), 'dd/MM/yyyy')
  } catch {
    return dia
  }
}

/**
 * Descreve **qual recorte está aplicado** — a frase muda com o filtro, porque a
 * pergunta respondida muda com ele.
 */
export function textoRecorteDeAtividade({
  from,
  to,
  ignorarPeriodo = false,
}: RecorteArgs): string {
  if (ignorarPeriodo) {
    return 'Mostrando todas, sem recorte de período.'
  }
  if (from && to) {
    return `Mostrando as que têm apontamento entre ${formatarDiaLocal(from)} e ${formatarDiaLocal(to)}.`
  }
  if (from) {
    return `Mostrando as que têm apontamento a partir de ${formatarDiaLocal(from)}.`
  }
  if (to) {
    return `Mostrando as que têm apontamento até ${formatarDiaLocal(to)}.`
  }
  return 'Sem período filtrado: mostrando todas.'
}

/**
 * Conjunto vazio de uma seção. É **sucesso**, não vazio-por-erro (AP-FRONTEND-021), e
 * o que ele significa depende do recorte: com período filtrado, "nenhuma" **não** é
 * "nenhuma no sistema".
 *
 * Para `anomalia` a frase diz explicitamente que nada exige conferência — é a
 * informação que o gestor procura, e um empty state neutro pareceria falha de carga.
 */
export function textoSecaoVazia(
  tipo: BillingExceptionTipo,
  { from, to, ignorarPeriodo = false }: RecorteArgs,
): string {
  const comRecorte = !ignorarPeriodo && Boolean(from || to)
  if (tipo === 'anomalia') {
    return comRecorte
      ? 'Nenhum chamado exige conferência no período filtrado.'
      : 'Nenhum chamado exige conferência: todo chamado em estágio fechado tem data de conclusão.'
  }
  return comRecorte
    ? 'Nada foi postergado no período filtrado — nenhum chamado aberto com horas apontadas.'
    : 'Nada foi postergado: nenhum chamado aberto com horas apontadas.'
}

/** Contagem de chamados de uma seção, com plural correto. */
export function textoContagemSecao(
  tipo: BillingExceptionTipo,
  count: number,
): string {
  if (tipo === 'anomalia') {
    return count === 1
      ? '1 chamado fechado sem data de conclusão'
      : `${count} chamados fechados sem data de conclusão`
  }
  return count === 1 ? '1 chamado ainda aberto' : `${count} chamados ainda abertos`
}

/**
 * Horas de cada seção — o destino é o que diferencia as duas.
 *
 * ⚠️ `postergado` **não** diz "vão para a próxima fatura": por D1 as horas entram na
 * fatura da competência em que o chamado FECHAR, que pode ser dali a vários meses.
 * "Próxima" seria uma afirmação de prazo que o sistema não garante
 * (AP-FRONTEND-022) — e é justamente o tipo de adjetivo que passa em revisão de copy.
 */
export function textoHorasSecao(
  tipo: BillingExceptionTipo,
  horasFormatadas: string,
): string {
  return tipo === 'anomalia'
    ? `${horasFormatadas} fora de qualquer fatura`
    : `${horasFormatadas} entram na fatura de quando o chamado fechar`
}

/**
 * 121/F7 — cabeçalho da coluna de horas, POR SEÇÃO.
 *
 * As colunas são as mesmas nas duas abas por desenho (AP-ARQUITETURA-005), mas o
 * cabeçalho **afirma o destino das horas**, e o destino é o que separa as duas seções:
 *  - `anomalia`: as horas estão **presas** — nenhuma fatura as recebe até a data de
 *    conclusão ser preenchida. Aqui o tom de alerta é a informação, e D14 quis
 *    justamente que ele não se diluísse;
 *  - `postergado`: nada está preso. As horas têm destino conhecido (a fatura da
 *    competência em que o chamado fechar) e a seção **não exige ação** — "Horas presas"
 *    ali pede providência onde não há nenhuma, que é o mesmo defeito de misturar as duas
 *    listas, só mais discreto.
 *
 * Nenhum dos dois textos afirma prazo ou periodicidade: "de quando o chamado fechar"
 * (nunca "na próxima") — por D1 pode ser dali a vários meses (AP-FRONTEND-022).
 */
export const TEXTO_COLUNA_HORAS: Record<
  BillingExceptionTipo,
  { header: string; info: string }
> = {
  anomalia: {
    header: 'Horas presas',
    info: 'Soma dos apontamentos concluídos do chamado (todos os baldes), sem recorte de período. É o trabalho que fica fora de qualquer fatura enquanto o chamado não tiver data de conclusão.',
  },
  postergado: {
    header: 'Horas do chamado',
    info: 'Soma dos apontamentos concluídos do chamado (todos os baldes), sem recorte de período. Entram na fatura da competência em que o chamado for concluído — nada aqui exige ação.',
  },
}

/**
 * ⚠️ Nota do ponto cego (F-15): chamado cujo `pipelineStage` não tem cadastro em
 * `pipelinestages` não casa o JOIN e **não aparece em nenhuma das duas seções**.
 *
 * AUSENTE ⇒ a nota aparece **sem número**. Não é omissão por preguiça: o backend
 * ainda não expõe a contagem, e escrever `0` afirmaria "não há nenhum" — exatamente a
 * conflação de "ausente" com "vazio" (AP-FRONTEND-021). Já `0` de verdade ⇒ nenhuma
 * nota, porque aí não há ponto cego a declarar.
 *
 * ⚠️ O guard é `== null` (121/F4): com `=== undefined` um `int?` nulo do backend caía no
 * ramo do número e a tela escrevia, literalmente, "null chamados não puderam ser
 * classificados…". Guard de ausência em campo que vem da REDE é `== null`.
 */
export function textoNaoClassificados(count: number | null | undefined): string | null {
  if (count == null) {
    return 'Chamados cujo estágio não tem cadastro não entram nesta conferência — a contagem ainda não está disponível.'
  }
  if (count === 0) return null
  return count === 1
    ? '1 chamado não pôde ser classificado (estágio sem cadastro) e não aparece em nenhuma das seções.'
    : `${count} chamados não puderam ser classificados (estágio sem cadastro) e não aparecem em nenhuma das seções.`
}
