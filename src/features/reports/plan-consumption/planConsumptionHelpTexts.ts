/**
 * 127/FE-AJUDA — textos e derivação do **indicador do botão de ajuda `(?)`** da tela de
 * Consumo de Planos.
 *
 * ## Por que este módulo existe
 *
 * Até a 127 a explicação de competência e o card de exceções ficavam abertos no topo da
 * tela. Recolhê-los atrás de um `(?)` (decisão do usuário em 08/09/2026, olhando a tela)
 * moveu para o **próprio botão** uma distinção que era feita pelo card: "não há exceções"
 * **nunca** pode parecer "a requisição falhou" (`AP-FRONTEND-021`). Com o conteúdo
 * recolhido, quem carrega essa distinção é o nome acessível do gatilho — e nome acessível
 * que afirma comportamento do sistema **é código, não copy** (`AP-FRONTEND-022`).
 *
 * Por isso a derivação mora aqui, pura e testável, e não espalhada no JSX: os **quatro**
 * estados são um conjunto fechado (`EstadoDaConferencia`), cada um com um texto e um
 * **glifo próprio** — nunca só uma cor (WCAG 1.4.1: cor não pode ser o único meio).
 *
 * ## O que cada estado afirma, e a âncora de cada afirmação
 *
 * | Estado | Quando | Afirma |
 * |---|---|---|
 * | `carregando` | a query do resumo ainda não respondeu | que ainda **não se sabe** |
 * | `erro` | a query falhou **ou** veio sem `anomaliasCount` | que **falhou** — nunca "zero" |
 * | `zero` | `anomaliasCount === 0` | que nada exige conferência |
 * | `pendente` | `anomaliasCount > 0` | **quantos** chamados exigem conferência |
 *
 * ⚠️ **`anomaliasCount` ausente cai em `erro`, não em `zero`.** O tipo do contrato diz
 * `number`, mas quem serializa é o outro lado: um `int?` do C# chega `null`, e o guard
 * `== null` (nunca `=== undefined`) é o que cobre os dois (`AP-FRONTEND-028`). Escrever
 * "nenhum chamado exige conferência" sem ter o número é exatamente a conflação que este
 * módulo existe para impedir.
 *
 * ⚠️ **O indicador olha só a seção ACIONÁVEL (`anomalias`).** É a mesma hierarquia que o
 * card já aplica desde F-15: `postergado` é informativo e **não exige ação**, e pedir
 * atenção onde não há ação é o mesmo defeito de misturar as duas listas. Com
 * `postergado > 0` e `anomalias === 0` o selo continua neutro — e o nome acessível
 * continua distinguindo isso de um erro de carga.
 */

/** Os quatro estados do indicador. Conjunto fechado — o `Record` abaixo obriga a tratar todos. */
export type EstadoDaConferencia = 'carregando' | 'erro' | 'zero' | 'pendente'

export type IndicadorDeConferencia = {
  estado: EstadoDaConferencia
  /**
   * Glifo/número **visível** do selo — o meio não-cromático da distinção.
   * `null` = sem selo (só o estado `zero`, que é o repouso).
   */
  selo: string | null
  /**
   * Nome acessível COMPLETO do botão — o que o leitor de tela lê **sem o usuário abrir**.
   * É aqui, e não num ponto colorido, que a distinção erro × zero × N vive.
   */
  nomeAcessivel: string
}

/** Rótulo visível do gatilho. O nome acessível sempre o CONTÉM (WCAG 2.5.3). */
export const TEXTO_AJUDA_ROTULO = 'Ajuda e conferência'

/**
 * O sufixo do nome acessível de cada estado sem número.
 * `erro` **nomeia a falha**; nenhum deles diz "0" nem soa como conjunto vazio.
 */
export const TEXTO_INDICADOR: Record<'carregando' | 'erro' | 'zero', string> = {
  carregando: 'verificando se há chamados a conferir',
  erro: 'não foi possível verificar se há chamados a conferir',
  zero: 'nenhum chamado exige conferência',
}

/** Glifo do selo nos estados sem número. `zero` não tem selo. */
export const SELO_INDICADOR: Record<'carregando' | 'erro', string> = {
  carregando: '…',
  erro: '!',
}

/** Sufixo com número, plural correto. É o "quantos" que o despacho exige. */
export function textoConferenciaPendente(count: number): string {
  return count === 1
    ? '1 chamado exige conferência'
    : `${count} chamados exigem conferência`
}

/** Monta o nome acessível: o rótulo visível + o que o indicador comunica. */
export function nomeAcessivelDaAjuda(sufixo: string): string {
  return `${TEXTO_AJUDA_ROTULO} — ${sufixo}`
}

export type ArgsDoIndicador = {
  isLoading: boolean
  isError: boolean
  /**
   * `anomaliasCount` do resumo. `null`/`undefined` = **não se sabe** (rede), nunca zero
   * — ver o guard `== null` no cabeçalho.
   */
  anomaliasCount: number | null | undefined
}

/**
 * Deriva o indicador do `(?)` a partir do estado da query do resumo.
 *
 * Ordem dos ramos, de propósito: `carregando` primeiro (é o único em que ainda não há
 * veredito nenhum), depois a **falha** — e a ausência do número é tratada como falha, não
 * como zero. Só o que sobra é dado.
 */
export function indicadorDeConferencia({
  isLoading,
  isError,
  anomaliasCount,
}: ArgsDoIndicador): IndicadorDeConferencia {
  if (isLoading) {
    return {
      estado: 'carregando',
      selo: SELO_INDICADOR.carregando,
      nomeAcessivel: nomeAcessivelDaAjuda(TEXTO_INDICADOR.carregando),
    }
  }
  if (isError || anomaliasCount == null) {
    return {
      estado: 'erro',
      selo: SELO_INDICADOR.erro,
      nomeAcessivel: nomeAcessivelDaAjuda(TEXTO_INDICADOR.erro),
    }
  }
  if (anomaliasCount <= 0) {
    // `<= 0` e não `=== 0`: contagem negativa é dado impossível; tratá-la como "há algo a
    // conferir" escreveria "-2 chamados exigem conferência" na tela.
    return {
      estado: 'zero',
      selo: null,
      nomeAcessivel: nomeAcessivelDaAjuda(TEXTO_INDICADOR.zero),
    }
  }
  return {
    estado: 'pendente',
    selo: String(anomaliasCount),
    nomeAcessivel: nomeAcessivelDaAjuda(textoConferenciaPendente(anomaliasCount)),
  }
}
