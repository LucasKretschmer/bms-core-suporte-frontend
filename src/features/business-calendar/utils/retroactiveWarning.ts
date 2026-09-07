import type { HolidayImpactDto } from '../types/calendar'
import { getCalendarErrorMessage } from './calendarErrorMessage'
import { dataCurta, ehDiaRetroativo } from './localDay'

/**
 * 124/F3 — **DD-2: mexer em feriado passado muda indicador do passado.**
 *
 * ## A dívida, escrita no registro da arquitetura
 *
 * `arquitetura.md` §7 DD-2: *"Feriado não tem vigência: acrescentar/remover feriado passado
 * muda indicador passado. **Por que é consciente:** feriado é fato datado, não política
 * (§4 ponto 3). **O que a paga:** aviso com contagem + confirmação na tela + trilha de
 * auditoria."*
 *
 * Expediente é versionado (A-5) justamente porque é **política**; feriado não é, porque
 * acrescentar "Carnaval 2026" **corrige** 2026 em vez de reescrever uma decisão. O resíduo é
 * real e é esta tela que o paga.
 *
 * ## A contagem vem da ROTA DE PRÉ-CONTAGEM, antes da escrita
 *
 * `GET /api/v1/calendars/{cid}/holidays/impacto?data=` (§1.4 do `be-f2f3-report.md`) devolve
 * `{ data, avisoRetroativo, ticketsFechadosNoDia }` **sem efeito colateral**, calculado pela
 * **mesma função** que a resposta de mutação usa. É por isso que o número que aparece na
 * confirmação é o número real, e não uma estimativa nem uma constante.
 *
 * A primeira versão desta unidade não tinha essa rota e contornou com "confirma por data agora,
 * mostra o número depois". O contorno **saiu**: mostrar o número depois da decisão não é o que
 * DD-2 pede.
 *
 * ## 🔴 O `0` que NÃO significa "sem impacto"
 *
 * `ticketsFechadosNoDia` vem **0 quando a data não é retroativa** — porque `avisoRetroativo`
 * é `data <= hoje` (decisão `P-6`) e a data, então, está no futuro. Nesse caso o número não é
 * uma medida de impacto: é o valor neutro de uma pergunta que não se aplica. Por isso, quando
 * `avisoRetroativo === false`, o texto **não exibe número nenhum** e diz o que de fato está
 * acontecendo ("é uma data futura"). Preferir não mostrar número a mostrar um número que
 * engana.
 *
 * ## 🔴 FONTE ÚNICA: quem AFIRMA é o servidor; o predicado local só ABRE a pergunta
 *
 * `datasRetroativas` (local, via {@link ehDiaRetroativo}) responde **sem rede** *"há o que
 * perguntar?"* — sem ele, todo salvamento de data futura pagaria uma requisição inútil. Mas
 * nenhuma frase desta tela afirma retroatividade a partir dele: `textoImpactos` e
 * `textoConfirmacaoRetroativa*` leem **exclusivamente** `impacto.avisoRetroativo`, o campo
 * que o servidor calcula em `HolidayService.CalcularImpactoAsync`.
 *
 * A consequência é a que interessa: quando as duas fronteiras discordam (virada do dia, ou
 * um deploy em que só um lado tem `P-6`), a tela **não mente** — ela mostra a resposta do
 * servidor. O predicado local só pode errar para o lado de perguntar à toa, nunca para o
 * lado de calar o aviso — **desde que as duas fronteiras coincidam**, e é por isso que
 * `localDay.test.ts` trava hoje e hoje + 1 dos dois lados dela.
 *
 * ## 🔴 OS CALL SITES DA GUARDA — lista completa, mantida aqui de propósito
 *
 * A primeira rodada implementou tudo isto com rigor no caminho de **um** feriado e deixou o
 * caminho que grava até 500 datas de uma vez **inteiramente sem guarda** (QA `D-1`). Guarda
 * paga no caminho unitário e não paga no caminho em lote é guarda não paga. Toda tela que
 * escreve feriado está nesta tabela; quem acrescentar uma quarta escreve a linha dela aqui:
 *
 * | Onde | Ação | Datas consultadas |
 * |---|---|---|
 * | `HolidayFormModal` | criar / editar | a nova e (na edição) a antiga |
 * | `HolidaysSection` | remover | a do feriado removido |
 * | `HolidayImportModal` | **importar planilha** | as retroativas do lote, até {@link MAX_DATAS_CONSULTADAS_NO_LOTE} |
 *
 * Nenhuma outra chamada de escrita de feriado existe no módulo: `useHolidayMutations` expõe
 * `create`/`update`/`remove`/`importar`, e os quatro são disparados pelos três componentes
 * acima.
 */

export type AcaoDeFeriado = 'criar' | 'editar' | 'remover'

const VERBO: Record<AcaoDeFeriado, string> = {
  criar: 'Cadastrar',
  editar: 'Alterar',
  remover: 'Remover',
}

/**
 * As datas **de hoje ou anteriores a hoje** entre as informadas, sem repetição e na ordem
 * recebida (`P-6`: hoje entra — chamado fechado hoje de manhã já tem indicador apurado).
 *
 * Editar tem duas datas relevantes — a antiga e a nova. Considerar só a nova deixaria metade
 * dos casos sem confirmação (mover um feriado de ontem para amanhã mexe no passado igual).
 *
 * É esta lista que vira as consultas de pré-contagem: **só** data futura não consulta nada.
 */
export function datasRetroativas(
  datas: readonly (string | null | undefined)[],
  hoje?: string,
): string[] {
  const vistas = new Set<string>()
  const retroativas: string[] = []
  for (const data of datas) {
    if (data == null || !ehDiaRetroativo(data, hoje)) continue
    if (vistas.has(data)) continue
    vistas.add(data)
    retroativas.push(data)
  }
  return retroativas
}

/** `true` quando **alguma** das datas envolvidas é de hoje ou anterior (`P-6`). */
export function exigeConfirmacaoRetroativa(
  datas: readonly (string | null | undefined)[],
  hoje?: string,
): boolean {
  return datasRetroativas(datas, hoje).length > 0
}

/** Título do diálogo de confirmação. */
export function tituloConfirmacaoRetroativa(acao: AcaoDeFeriado): string {
  return `${VERBO[acao]} feriado em data de hoje ou anterior`
}

// ─────────────────────────────────────────────────────────────────────────────
// O mesmo padrão, no LOTE (importação de planilha)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 🔴 Teto de **consultas** de pré-contagem num lote.
 *
 * A pré-contagem é `GET .../holidays/impacto?data=` — **uma requisição por data**, e o
 * lote aceita até `MAX_ITENS_IMPORTACAO` (500) linhas. Sem teto, um clique dispararia 500
 * requisições e o diálogo ficaria travado esperando todas: a guarda de DD-2 viraria uma
 * tela pendurada, que o usuário aprende a contornar.
 *
 * 30 é escolhido pelo dado real, não por gosto: um arquivo de "feriados do ano" tem 12–14
 * nacionais mais municipais, e mesmo importado em dezembro nem todos são passados. Ou
 * seja, **o arquivo típico nunca é truncado**; o teto só age no arquivo atípico (vários
 * anos de uma vez), e nesse caso a tela diz, com todas as letras, que a soma exibida é um
 * **piso** e não o total.
 *
 * O que NUNCA é truncado é a **quantidade de datas retroativas**: ela é calculada aqui, sem
 * rede, e é sempre exata. Mesmo no arquivo grande o usuário vê o tamanho do efeito.
 */
export const MAX_DATAS_CONSULTADAS_NO_LOTE = 30

/**
 * Teto de datas **escritas por extenso** no diálogo.
 *
 * O `ConfirmDialog` compartilhado renderiza a descrição num único `<p>` de `max-w-sm`.
 * Despejar 30 datas ali é a mesma falha de um aviso ausente: ninguém lê a parede de texto.
 * Acima disso a lista é cortada com "e mais N" e o número que importa — o total de
 * chamados — vem agregado.
 */
export const MAX_DATAS_LISTADAS_NO_LOTE = 10

/** Português correto no singular — nada de "1 data(s)" (o defeito `D-9` do QA). */
function plural(quantidade: number, singular: string, plural: string): string {
  return quantidade === 1 ? singular : plural
}

/** As datas que de fato viram requisição: as retroativas, até o teto. */
export function datasParaConsultarNoLote(retroativas: readonly string[]): string[] {
  return retroativas.slice(0, MAX_DATAS_CONSULTADAS_NO_LOTE)
}

/** Título do diálogo do lote — já traz a contagem de datas retroativas. */
export function tituloConfirmacaoRetroativaEmLote(quantidadeDeDatas: number): string {
  return `Importar ${quantidadeDeDatas} ${plural(quantidadeDeDatas, 'feriado', 'feriados')} em ${plural(quantidadeDeDatas, 'data de hoje ou anterior', 'datas de hoje ou anteriores')}`
}

/** Lista curta de datas, cortada no teto de exibição. */
export function listaDeDatasResumida(
  datas: readonly string[],
  teto: number = MAX_DATAS_LISTADAS_NO_LOTE,
): string {
  const mostradas = datas.slice(0, teto).map(dataCurta)
  const restantes = datas.length - mostradas.length
  if (restantes <= 0) return mostradas.join(', ')
  return `${mostradas.join(', ')} e mais ${restantes}`
}

/**
 * Soma das contagens, **só das datas que o servidor confirmou como retroativas**.
 *
 * Um chamado fecha num dia só, então somar dias distintos não conta ninguém duas vezes.
 * As datas que voltarem com `avisoRetroativo: false` (divergência de relógio na virada do
 * dia) ficam de fora da soma e são reportadas à parte — incluir o `0` delas na conta seria
 * o mesmo `0` enganoso do bloco 🔴 do topo, agora diluído numa soma.
 */
export function somaDosImpactos(impactos: readonly HolidayImpactDto[]): {
  chamados: number
  datasComAviso: number
  datasSemAviso: number
} {
  const comAviso = impactos.filter((i) => i.avisoRetroativo)
  return {
    chamados: comAviso.reduce((total, i) => total + i.ticketsFechadosNoDia, 0),
    datasComAviso: comAviso.length,
    datasSemAviso: impactos.length - comAviso.length,
  }
}

/**
 * Texto da confirmação do **lote**.
 *
 * Mesma regra do caminho de um feriado: nunca há número na tela antes de `pronto`. A
 * diferença é o que se agrega — a soma dos chamados afetados — e a honestidade sobre o
 * teto: quando nem todas as datas retroativas foram consultadas, o texto diz que o número
 * exibido é o das consultadas e que o efeito real é maior. Afirmar um total que não foi
 * medido seria pior que não afirmar nenhum.
 */
export function textoConfirmacaoRetroativaEmLote(
  totalDeLinhas: number,
  retroativas: readonly string[],
  estado: EstadoDoImpacto,
): string {
  const quantas = retroativas.length
  const base =
    `Esta importação grava ${quantas} ${plural(quantas, 'data de hoje ou anterior', 'datas de hoje ou anteriores')} ` +
    `(${listaDeDatasResumida(retroativas)}), de ${totalDeLinhas} ${plural(totalDeLinhas, 'linha', 'linhas')} do arquivo. ` +
    'Feriados não são versionados: o cálculo de SLA de 1º atendimento dos chamados daqueles dias ' +
    'passa a considerar a nova configuração, e indicadores já apurados mudam de valor.'

  switch (estado.tipo) {
    case 'carregando':
      return `${base} Consultando quantos chamados fechados são afetados…`
    case 'erro':
      return (
        `${base} Não foi possível consultar quantos chamados são afetados: ${estado.mensagem} ` +
        'Você pode confirmar mesmo assim, mas sem esse número na frente.'
      )
    case 'pronto': {
      const { chamados, datasSemAviso } = somaDosImpactos(estado.impactos)
      const consultadas = estado.impactos.length
      const naoConsultadas = quantas - consultadas
      const contagem =
        naoConsultadas > 0
          ? `Nas ${consultadas} primeiras dessas datas, ${chamados} ${plural(chamados, 'chamado já fechado tem', 'chamados já fechados têm')} ` +
            `os indicadores recalculados; as outras ${naoConsultadas} não foram consultadas ` +
            `(é uma consulta por data, e o teto é ${MAX_DATAS_CONSULTADAS_NO_LOTE}), então o efeito real é maior.`
          : `Ao todo, ${chamados} ${plural(chamados, 'chamado já fechado tem', 'chamados já fechados têm')} os indicadores recalculados.`
      const divergencia =
        datasSemAviso > 0
          ? ` ${datasSemAviso} ${plural(datasSemAviso, 'data não é considerada retroativa', 'datas não são consideradas retroativas')} pelo servidor e ${plural(datasSemAviso, 'ficou', 'ficaram')} fora dessa soma.`
          : ''
      return `${base} ${contagem}${divergencia}`
    }
    case 'ocioso':
      return base
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Estado da pré-contagem
// ─────────────────────────────────────────────────────────────────────────────

/** O mínimo que este módulo precisa de um resultado de query — sem acoplar ao TanStack. */
export type ResultadoDeImpacto = {
  isLoading: boolean
  isError: boolean
  error: unknown
  data: HolidayImpactDto | undefined
}

export type EstadoDoImpacto =
  /** Nenhuma data retroativa envolvida: não há o que consultar. */
  | { tipo: 'ocioso' }
  /** A resposta ainda não chegou — **não se afirma número nenhum** enquanto isto valer. */
  | { tipo: 'carregando' }
  | { tipo: 'erro'; mensagem: string }
  | { tipo: 'pronto'; impactos: HolidayImpactDto[] }

/**
 * Reduz os N resultados a um estado só.
 *
 * A ordem das guardas importa: **carregando vence erro e vence pronto**. Enquanto uma das
 * consultas não voltou, a tela não pode afirmar um total — "ainda não sei" e "não há" são
 * respostas diferentes (AP-FRONTEND-021), e é justamente aqui que confundi-las viraria um
 * "0 chamados afetados" falso.
 */
export function estadoDoImpacto(resultados: readonly ResultadoDeImpacto[]): EstadoDoImpacto {
  if (resultados.length === 0) return { tipo: 'ocioso' }
  if (resultados.some((r) => r.isLoading)) return { tipo: 'carregando' }

  const comErro = resultados.find((r) => r.isError)
  if (comErro !== undefined) {
    return { tipo: 'erro', mensagem: getCalendarErrorMessage(comErro.error) }
  }

  const impactos = resultados.map((r) => r.data).filter((d): d is HolidayImpactDto => d != null)
  if (impactos.length !== resultados.length) return { tipo: 'carregando' }

  return { tipo: 'pronto', impactos }
}

/**
 * `true` enquanto a contagem **ainda não chegou**.
 *
 * O ponto de DD-2 é decidir **vendo o número**; confirmar antes de ele chegar seria burlar a
 * própria guarda. Erro **não** bloqueia: a data que a pré-contagem recusa é a mesma que a
 * escrita recusa, com o mesmo `error.code` e a mesma mensagem inline — travar a tela num
 * endpoint auxiliar indisponível impediria trabalho legítimo sem proteger nada.
 */
export function impactoBloqueiaConfirmacao(estado: EstadoDoImpacto): boolean {
  return estado.tipo === 'carregando'
}

/**
 * A frase da contagem, por data.
 *
 * O ramo é escolhido **só** por `impacto.avisoRetroativo` — o campo do servidor. Nenhuma
 * comparação de data acontece aqui: é o que garante que a tela e o servidor nunca digam
 * coisas diferentes sobre a mesma data (bloco 🔴 "FONTE ÚNICA" do topo).
 *
 * - `avisoRetroativo === true` ⇒ mostra **o número** e o que ele significa;
 * - `avisoRetroativo === false` ⇒ a data está **no futuro** (`P-6`: a fronteira é `<= hoje`),
 *   e então **não mostra número** (ver o bloco 🔴 do `0` enganoso).
 */
export function textoImpactos(impactos: readonly HolidayImpactDto[]): string {
  return impactos
    .map((impacto) => {
      if (!impacto.avisoRetroativo) {
        return `${dataCurta(impacto.data)} é uma data futura: nenhum indicador já apurado muda.`
      }
      const quantidade = impacto.ticketsFechadosNoDia
      const plural = quantidade === 1 ? 'chamado já fechado' : 'chamados já fechados'
      return `${dataCurta(impacto.data)}: ${quantidade} ${plural} naquele dia ${quantidade === 1 ? 'tem' : 'têm'} os indicadores recalculados.`
    })
    .join(' ')
}

/**
 * Texto da confirmação: o que muda **mais** a contagem real, no estado em que ela estiver.
 *
 * Nunca há número na tela antes de `pronto` — nem `0`, nem "—". Enquanto carrega, o texto diz
 * que está consultando; se falhar, diz que **não conseguiu consultar** (e não que não há
 * impacto).
 */
export function textoConfirmacaoRetroativa(
  acao: AcaoDeFeriado,
  datas: readonly string[],
  estado: EstadoDoImpacto,
): string {
  const lista = datas.map(dataCurta).join(' e ')
  const alvo =
    datas.length > 1
      ? `as datas ${lista}, de hoje ou anteriores`
      : `a data ${lista}, de hoje ou anterior`

  const base =
    `${VERBO[acao]} este feriado envolve ${alvo}. ` +
    'Feriados não são versionados: o cálculo de SLA de 1º atendimento dos chamados daquele dia ' +
    'passa a considerar a nova configuração, e indicadores já apurados mudam de valor.'

  switch (estado.tipo) {
    case 'carregando':
      return `${base} Consultando quantos chamados fechados são afetados…`
    case 'erro':
      return (
        `${base} Não foi possível consultar quantos chamados são afetados: ${estado.mensagem} ` +
        'Você pode confirmar mesmo assim, mas sem esse número na frente.'
      )
    case 'pronto':
      return `${base} ${textoImpactos(estado.impactos)}`
    case 'ocioso':
      return base
  }
}
