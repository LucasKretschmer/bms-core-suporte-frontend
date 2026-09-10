import { z } from 'zod'

/**
 * Tipos e schemas do Crédito de Horas — demanda 132/F5.
 *
 * Contrato: `arquitetura.md:891-923` · `analise-backend.md` §7.2. O backend desta demanda
 * **ainda não existe** (não há `HourCreditsController.cs`, verificado em
 * `src/Suporte.API/Controllers` no dia da implementação): este arquivo espelha o contrato
 * congelado, não código medido.
 */

// ── Vocabulário do servidor (AP-API-002) ─────────────────────────────────────────────

/**
 * 🔴 **O conjunto de status vem do servidor** (`CreditoStatusRegras`, derivado) — aqui ele é
 * declarado UMA vez, e a **identidade** do conjunto é travada por teste. Redigitar a união
 * em cada ponto de uso é como cliente e servidor divergem em silêncio (`AP-API-002`).
 */
export const STATUS_DO_CREDITO = ['vigente', 'expirado', 'estornado'] as const
export type StatusDoCredito = (typeof STATUS_DO_CREDITO)[number]

/** Idem para a origem (`CreditoOrigemValores.TryResolve`). */
export const ORIGENS_DO_CREDITO = ['automatico', 'manual'] as const
export type OrigemDoCredito = (typeof ORIGENS_DO_CREDITO)[number]

/** O que o front usa quando o servidor manda algo que esta versão não conhece. */
export const TOKEN_DESCONHECIDO = 'desconhecido'

/**
 * Normaliza o status bruto do wire, **fail-closed**.
 *
 * `'desconhecido'` — nunca um dos três — para valor ausente, `null` ou fora do conjunto.
 * Mapear o desconhecido para `'vigente'` afirmaria que o crédito ainda vale; para
 * `'estornado'`, que já não vale. As duas são afirmações que o painel não tem como
 * sustentar.
 *
 * `== null` (não `=== undefined`): chave omitida e `null` são o **mesmo fato** para quem
 * consome — `AP-FRONTEND-028`.
 */
export function normalizarStatusDoCredito(
  bruto: string | null | undefined,
): StatusDoCredito | typeof TOKEN_DESCONHECIDO {
  if (bruto == null) return TOKEN_DESCONHECIDO
  return (STATUS_DO_CREDITO as readonly string[]).includes(bruto)
    ? (bruto as StatusDoCredito)
    : TOKEN_DESCONHECIDO
}

export function normalizarOrigemDoCredito(
  bruto: string | null | undefined,
): OrigemDoCredito | typeof TOKEN_DESCONHECIDO {
  if (bruto == null) return TOKEN_DESCONHECIDO
  return (ORIGENS_DO_CREDITO as readonly string[]).includes(bruto)
    ? (bruto as OrigemDoCredito)
    : TOKEN_DESCONHECIDO
}

/**
 * Rótulos por membro do conjunto — **um texto por membro, nunca um texto para a família**.
 * `AP-API-002`, segunda metade: frase colada numa família de status precisa ser verdadeira
 * para todo membro **futuro** dela; como não há como garantir isso, aqui cada membro tem o
 * seu, e o membro que não existe no mapa não recebe texto nenhum.
 */
const ROTULO_POR_STATUS: Record<StatusDoCredito, string> = {
  vigente: 'Vigente',
  expirado: 'Expirado',
  estornado: 'Estornado',
}

const ROTULO_POR_ORIGEM: Record<OrigemDoCredito, string> = {
  automatico: 'Automático',
  manual: 'Manual',
}

/**
 * Texto do status para a tabela e para o filtro. Status desconhecido é exibido **cru** (é
 * informação real do servidor, e a tela é de gerência) — nunca traduzido para um dos três
 * conhecidos. Ausente/`null` ⇒ `'—'`.
 */
export function rotuloDoStatus(bruto: string | null | undefined): string {
  const normalizado = normalizarStatusDoCredito(bruto)
  if (normalizado === TOKEN_DESCONHECIDO) return bruto == null ? '—' : bruto
  return ROTULO_POR_STATUS[normalizado]
}

export function rotuloDaOrigem(bruto: string | null | undefined): string {
  const normalizado = normalizarOrigemDoCredito(bruto)
  if (normalizado === TOKEN_DESCONHECIDO) return bruto == null ? '—' : bruto
  return ROTULO_POR_ORIGEM[normalizado]
}

// ── DTO do wire ──────────────────────────────────────────────────────────────────────

/**
 * `HourCreditDto` — `arquitetura.md:897-917`.
 *
 * 🔴 `status` e `origem` são declarados **`string`**, não a união literal. Declarar a união
 * seria mentir para o compilador sobre um valor que o **servidor** controla: um valor novo
 * passaria a ser tratado como se fosse um dos conhecidos, sem nenhum aviso. A união entra
 * só depois de `normalizarStatusDoCredito` (`AP-API-002`, mesmo desenho de `fonte` em
 * `analise-frontend.md` §4.2).
 *
 * Campos derivados e opcionais são `?: T | null` porque atravessam a rede: chave omitida e
 * `null` são o mesmo fato, e o guard tem de ser `== null` (`AP-FRONTEND-028`).
 */
export type HourCreditDto = {
  id: number
  clientId: number
  clienteNome?: string | null
  cnpj?: string | null
  horas: number
  /** Competência de vigência, `"YYYY-MM"`. UMA só — D8′: o crédito vale uma competência. */
  competencia: string
  competenciaOrigem?: string | null
  /** Vocabulário do servidor — ler sempre por `normalizarStatusDoCredito`/`rotuloDoStatus`. */
  status?: string | null
  origem?: string | null
  motivoId: number
  /** Texto COMPLETO do motivo — D15, exibido só nas telas `GerentePlus`. */
  motivoNome?: string | null
  ticketId?: number | null
  hubspotTicketId?: string | null
  /**
   * ⚠️ **Não está no contrato de `arquitetura.md:891-923`** — declarado opcional e lido só
   * quando vier. É a mesma chave que os outros 4 pontos do repo usam para linkar um ticket
   * (`client-tickets/columns.tsx:77`, `reports/appointments/columns.tsx:135`…), e a URL do
   * HubSpot **nunca** é montada no front (seria URL hardcoded). Sem ela, a coluna Chamado
   * mostra `#id` em texto. Pendência registrada para o Manager.
   */
  hubspotUrl?: string | null
  faturamentoSnapshotId?: number | null
  /** C-8 — divergência detectada após refechamento. `null` ⇒ desconhecido, nunca "Não". */
  divergenteDoSnapshot?: boolean | null
  consumidoHoras?: number | null
  perdidoHoras?: number | null
  estornadoEm?: string | null
  estornadoMotivo?: string | null
  criadoEm: string
  /** `null` = criado pelo processo automático (sistema). */
  criadoPorNome?: string | null
}

// ── Schemas do formulário ────────────────────────────────────────────────────────────

/**
 * `z.coerce.number()`, **nunca `z.number()`**: `<input>` devolve `string`, e `z.number()`
 * reprovaria toda digitação — o formulário jamais enviaria (memória
 * `dto-request-id-tipo-int`: tipo errado na fronteira vira `400` silencioso mascarado por
 * toast genérico).
 *
 * ⚠️ **Sem teto de horas.** `numeric(10,4)` e o `CHECK horas > 0` são do banco; o teto de
 * 10.000 aparece no *validator proposto* pela `analise-backend.md` §7.2, que ainda não é
 * código. Digitar aqui um número sem âncora em constante compartilhada é exatamente o
 * `AP-FRONTEND-022`. O schema valida `> 0`; o resto vem da mensagem do servidor.
 */
const horasField = z.coerce
  .number({ message: 'Informe as horas do crédito.' })
  .positive('Informe um número de horas maior que zero.')

const clientIdField = z.coerce
  .number({ message: 'Selecione o cliente.' })
  .int('Selecione o cliente.')
  .positive('Selecione o cliente.')

const motivoIdField = z.coerce
  .number({ message: 'Selecione o motivo.' })
  .int('Selecione o motivo.')
  .positive('Selecione o motivo.')

/**
 * 🔴 **Exatamente três campos** — `arquitetura.md:917`. Não existe campo de período final
 * (D8′: o crédito vale UMA competência, sem estender validade e sem mover) nem campo de
 * competência (é derivada no servidor). `origem`, `ticketId`, `competenciaOrigem` e
 * `criadoPorUserId` **nunca** vêm do cliente (`rules/security.md` § "nunca aceitar no
 * body").
 */
export const novoCreditoSchema = z.object({
  clientId: clientIdField,
  horas: horasField,
  motivoId: motivoIdField,
})

/** `PUT /hour-credits/{id}` aceita **só** `{ horas, motivoId }` (`arquitetura.md:920`). */
export const editarCreditoSchema = novoCreditoSchema.pick({ horas: true, motivoId: true })

/**
 * ⚠️ **Dois tipos por formulário, de propósito** — entrada e saída do schema.
 *
 * `z.coerce.number()` tem tipo de ENTRADA `unknown` (é isso que permite receber a `string`
 * do `<input>`) e saída `number`. O `Resolver` do React Hook Form é contravariante na
 * entrada: tipar o `useForm` só com a saída produz
 * `Resolver<{horas: unknown}> não é atribuível a Resolver<{horas: number}>` — o erro
 * aparece no `useForm`, longe da causa, exatamente como em `AP-FRONTEND-023`.
 *
 * A forma correta é `useForm<Input, unknown, Values>`: o formulário guarda a entrada crua e
 * o `handleSubmit` entrega a saída **já coagida**.
 */
export type NovoCreditoFormInput = z.input<typeof novoCreditoSchema>
export type NovoCreditoFormValues = z.output<typeof novoCreditoSchema>
export type EditarCreditoFormInput = z.input<typeof editarCreditoSchema>
export type EditarCreditoFormValues = z.output<typeof editarCreditoSchema>
