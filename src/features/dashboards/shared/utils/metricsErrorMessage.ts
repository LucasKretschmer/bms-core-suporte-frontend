import { isAxiosError } from 'axios'

/**
 * 124/FE-P3 — tradução dos erros de `/metrics/*` que o dashboard precisa explicar.
 *
 * ## O que esta unidade fecha
 *
 * `BE-FIX1` (achado de segurança `S-1`) pôs um teto na janela **já resolvida** das duas
 * apurações caras — `DateRangeGuard.EnsureJanelaResolvida`, chamado de
 * `MetricsService.ExigirJanelaApuravel` (`MetricsService.cs:604`). A partir dela,
 * `GET /metrics/overview` e o drill `?metric=tickets-sla|tickets-fcr` podem responder
 * **422** com `error.code = "DATE_RANGE_TOO_LARGE"`
 * (`DateRangeGuard.cs:38`, `:163-167`).
 *
 * Esse código **não tinha tratamento nenhum aqui**: quem pedisse um período largo via
 * *"Não foi possível carregar os KPIs."* / *"Ocorreu um erro ao carregar os dados."* —
 * sem saber que o problema é o **tamanho do período** nem o que fazer a respeito. É a
 * mesma classe de defeito que `FE-F4` e `FE-TXT` fecharam nesta demanda: a tela sabendo
 * menos do que o servidor disse.
 *
 * ## Reconhecimento por CÓDIGO, nunca por texto
 *
 * O discriminador é `error.code` do envelope (`rules/api.md`:
 * `{ error: { code, message, details[] } }`, montado em
 * `ExceptionHandlingMiddleware.cs:89-97` a partir de `DomainValidationException`).
 * Casar por texto quebraria em silêncio na primeira vez que alguém ajustasse a redação
 * no backend. Mesmo mecanismo de `features/support-plans/utils/planErrorMessage.ts`,
 * `features/business-calendar/utils/calendarErrorMessage.ts` e
 * `features/service-categories/utils/categoryErrorMessage.ts` — **nenhum segundo
 * mecanismo foi inventado aqui**.
 *
 * ## 🔴 O limite (366 dias) NÃO é repetido no frontend
 *
 * O teto vive em `DateRangeGuard.MaxRangeDays` e chega até aqui **dentro da mensagem**
 * do envelope, interpolado da própria constante
 * (`DateRangeGuard.RangeTooLargeErrorMessage`, `DateRangeGuard.cs:56-58`):
 *
 * > *"O período não pode ser maior que 1 ano (366 dias). Escolha um intervalo menor — por
 * > exemplo um mês, ou o ano corrente — e consulte os períodos anteriores em consultas
 * > separadas."*
 *
 * Não há campo estruturado com o número no corpo da resposta (`details[]` traz
 * `{ field: "from", message: <a mesma frase> }`), então a mensagem do servidor é
 * **preservada inteira** — é ela, e só ela, que diz **qual é o máximo**. Escrever `366`
 * no frontend criaria a segunda fonte de verdade que esta demanda inteira existe para
 * eliminar, e ela mentiria em silêncio no dia em que o backend mudasse o teto
 * (`AP-FRONTEND-022`).
 *
 * O acréscimo local é só a **ação na tela** — o servidor sabe o limite, não sabe que
 * deste lado existe um filtro de período.
 */

/** Códigos de erro de `/metrics/*` que a tela traduz. Literais do backend. */
export const METRICS_ERROR_CODES = {
  /**
   * 422 — a janela **resolvida** passou de `DateRangeGuard.MaxRangeDays`.
   * Alcança `GET /metrics/overview` e `GET /metrics/rows?metric=tickets-sla|tickets-fcr`
   * (`be-fix1-report.md` §4.3).
   */
  DATE_RANGE_TOO_LARGE: 'DATE_RANGE_TOO_LARGE',
} as const

/** Envelope de erro do backend: `{ error: { code, message, details[] } }` (camelCase). */
type CorpoDeErro = {
  error?: {
    code?: unknown
    message?: unknown
  }
}

function corpoDoErro(error: unknown): CorpoDeErro['error'] | undefined {
  if (!isAxiosError(error)) return undefined
  const body = error.response?.data as CorpoDeErro | undefined
  return body?.error
}

/** `error.code` do envelope, ou `null`. Sem `any`. */
export function getMetricsErrorCode(error: unknown): string | null {
  const code = corpoDoErro(error)?.code
  return typeof code === 'string' && code.length > 0 ? code : null
}

/**
 * Ação que resolve — e é a única parte da frase que o servidor não teria como escrever.
 *
 * Sem referência de posição ("acima", "à direita") de propósito: as mesmas seções são
 * renderizadas dentro do **Modo Painel** (`PanelMode`), onde a barra de filtros não
 * existe. Texto de UI que afirma onde as coisas estão é afirmação verificável, e esta
 * seria falsa em uma das duas telas (`AP-FRONTEND-022`).
 */
export const ACAO_JANELA_GRANDE_DEMAIS = 'Ajuste o filtro de período.'

/**
 * Usada **apenas** quando o 422 chega sem mensagem no envelope — nunca no lugar dela.
 * Não cita número: o limite é do servidor, e aqui ele é desconhecido.
 */
export const JANELA_GRANDE_DEMAIS_SEM_MENSAGEM =
  'O período selecionado é maior que o máximo aceito pelo servidor.'

/**
 * Mensagem do `422 DATE_RANGE_TOO_LARGE`, ou `null` para qualquer outro erro.
 *
 * `null` (e não uma mensagem genérica) porque cada ponto da tela já tem o **seu** texto
 * genérico — o da seção de KPIs difere do `ErrorState` padrão do card. Devolver `null`
 * deixa o tratamento genérico exatamente como está, que é o que a companheira positiva
 * dos testes prova.
 */
export function mensagemDeJanelaGrandeDemais(error: unknown): string | null {
  if (getMetricsErrorCode(error) !== METRICS_ERROR_CODES.DATE_RANGE_TOO_LARGE) return null

  const doServidor = corpoDoErro(error)?.message
  const base =
    typeof doServidor === 'string' && doServidor.length > 0
      ? doServidor
      : JANELA_GRANDE_DEMAIS_SEM_MENSAGEM

  return base.includes(ACAO_JANELA_GRANDE_DEMAIS)
    ? base
    : `${base} ${ACAO_JANELA_GRANDE_DEMAIS}`
}
