import { z } from 'zod'

/**
 * Tipos do wire da tela de Competências (132/F7) — espelham o contrato de
 * `arquitetura.md` §11.4 / `analise-backend.md` §7.4, **não** um DTO em memória.
 *
 * Convenção aplicada a todo campo que atravessa a rede: **opcional e anulável**
 * (`?: T | null`). Não é frescura de tipagem — é o que obriga cada call site a decidir os
 * dois ramos e o que impede "não sei" de virar "não" ou "zero"
 * (`AP-FRONTEND-021`/`AP-FRONTEND-028`). Todo guard aqui e nos consumidores é `== null`.
 */

/** `GET /api/v1/billing-periods` → `PaginatedResponse<BillingPeriodDto>` (envelope CRU). */
export type BillingPeriodDto = {
  /** `"YYYY-MM"`. */
  competencia: string
  /**
   * Vocabulário do servidor — `string` no wire de propósito, nunca a união literal.
   * Declará-lo como a união seria mentir para o compilador sobre um valor que o servidor
   * controla, e faria um valor novo ser tratado como se fosse um dos conhecidos
   * (`AP-API-002`). Quem interpreta é `normalizarEstado` (`estadoDaCompetencia.ts`).
   */
  estado?: string | null
  fechadaEm?: string | null
  /** `null` **com** `fechadaEm` preenchido = fechamento pelo processo automático. */
  fechadaPorNome?: string | null
  reabertaEm?: string | null
  reabertaPorNome?: string | null
  reaberturaMotivo?: string | null
  versao?: number | null
  totalClientes?: number | null
  totalHorasAdicionais?: number | null
  /**
   * C-8 — quantos créditos **vivos** têm `competenciaOrigem` nesta competência, para o
   * diálogo de reabertura poder avisar **antes**.
   *
   * ⚠️ **Campo ADITIVO que o contrato de hoje NÃO especifica** (`arquitetura.md` §11.4 e
   * `analise-backend.md` §7.4 não o listam). Enquanto ele não existir, a resposta chega
   * sem a chave e o diálogo **não afirma número nenhum** — ele explica o impacto em
   * palavras e, se o servidor recusar com `409
   * COMPETENCIA_COM_CREDITOS_DEPENDENTES`, exibe a contagem que vier na mensagem do
   * servidor. Inventar um número aqui seria pior que não ter número.
   * Pendência registrada no relatório da unidade.
   */
  creditosDependentes?: number | null
}

/** Um lado da comparação de auditoria (`arquitetura.md` §8.2). */
export type BillingPeriodComparisonValoresDto = {
  planoBaseHoras?: number | null
  creditoHoras?: number | null
  planoEfetivoHoras?: number | null
  horasUsadas?: number | null
  horasRestantes?: number | null
  horasAdicionais?: number | null
  percentualPlano?: number | null
  horasFaturaveis?: number | null
  horasAnalise?: number | null
}

/**
 * `GET /api/v1/billing-periods/{competencia}/comparison` →
 * `PaginatedResponse<BillingPeriodComparisonItemDto>`.
 */
export type BillingPeriodComparisonItemDto = {
  clientId: number
  clienteNome?: string | null
  snapshot?: BillingPeriodComparisonValoresDto | null
  aoVivo?: BillingPeriodComparisonValoresDto | null
  temDivergencia?: boolean | null
  /**
   * Nomes **camelCase** dos campos divergentes, decididos pelo servidor. 🔴 O front
   * **não** recalcula divergência comparando números: seria uma segunda fonte de verdade
   * sobre o que já foi decidido lá (e com outro arredondamento).
   */
  camposDivergentes?: string[] | null
}

/** Corpo de `POST /api/v1/billing-periods/{competencia}/reopen`. */
export type ReabrirCompetenciaBody = {
  motivo: string
  confirmarImpactoEmCreditos: boolean
}

/**
 * Limites do `motivo` — **espelham o backend, que é a fonte de verdade**:
 * `{ motivo: string(3..255) }` (`arquitetura.md` §6.4 e §11.4). Existem como constantes
 * para que o número exibido ao usuário venha da MESMA fonte do número validado
 * (`AP-FRONTEND-022`): mudar o limite aqui muda schema e texto juntos.
 */
export const MOTIVO_MIN_LENGTH = 3
export const MOTIVO_MAX_LENGTH = 255

/**
 * Schema do formulário de reabertura (C-8). O schema é a fonte da verdade da validação
 * de UX; o backend valida de novo.
 *
 * `confirmarImpactoEmCreditos` é `z.literal(true)`: a confirmação de impacto é
 * **obrigatória**, e o formulário não tem como enviar `false`. Sem ela, o backend
 * responderia `409 COMPETENCIA_COM_CREDITOS_DEPENDENTES` num laço que o usuário não
 * entende — e, pior, um `false` enviado por descuido reabriria em silêncio a competência
 * que **não** tem dependentes, sem que a gerente tivesse lido o aviso.
 */
export const reabrirCompetenciaSchema = z.object({
  motivo: z
    .string()
    .trim()
    .min(MOTIVO_MIN_LENGTH, `Descreva o motivo com pelo menos ${MOTIVO_MIN_LENGTH} caracteres.`)
    .max(MOTIVO_MAX_LENGTH, `O motivo deve ter no máximo ${MOTIVO_MAX_LENGTH} caracteres.`),
  /**
   * `z.boolean().refine(...)` e não `z.literal(true)`: o tipo de SAÍDA continua `boolean`,
   * que é o que o `defaultValues` do RHF (`false`) e o checkbox precisam. O retorno da
   * função vai anotado `: boolean` de propósito — sem a anotação o TS 5.5+ infere um
   * type-guard, o Zod estreita a saída e o erro aparece lá no `useForm`, longe da causa
   * (`AP-FRONTEND-023`).
   */
  confirmarImpactoEmCreditos: z
    .boolean()
    .refine((valor): boolean => valor === true, {
      message: 'Confirme que leu o impacto sobre os créditos para poder reabrir.',
    }),
})

export type ReabrirCompetenciaFormValues = z.infer<typeof reabrirCompetenciaSchema>
