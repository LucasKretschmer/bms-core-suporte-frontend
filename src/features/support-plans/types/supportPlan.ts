import { z } from 'zod'

/**
 * 124/F1 — Planos de suporte.
 *
 * ## De onde vem cada campo (nada aqui é de memória)
 *
 * **Campos que JÁ existem hoje** — lidos em
 * `Suporte.Application/DTOs/Config/SupportPlanDtos.cs:5-11` (`SupportPlanDto`):
 * `Id`, `Nome`, `HorasMes`, `PrecoHoraExtra`, `Moeda`, `IsActive`.
 *
 * ⚠️ `isActive` **não está listado** no contrato preliminar da arquitetura
 * (`124/arquitetura.md` §3 "F1 — Planos"), mas **existe na resposta de hoje**
 * (`SupportPlanService.cs:88-94` → `IsActive: p.DesativadoEm is null`). O §3 diz
 * "campos existentes **+** os 5 aditivos (nenhum removido, nenhum renomeado)", logo a
 * leitura conservadora é manter `isActive` na RESPOSTA. Ele **não** entra no request:
 * `Create/UpdateSupportPlanDto` (`SupportPlanDtos.cs:14,17`) não o aceitam — desativar
 * plano é `DELETE` (soft delete), não `PUT`.
 *
 * **Os 5 aditivos de 124** — `arquitetura.md` §3, com os limites vindos da DDL de §5:
 * | Campo | Limite | Origem |
 * |---|---|---|
 * | `hubspotValor` | `varchar(255)`, único (case-insensitive) | M1 |
 * | `slaPrimeiroAtendimentoMinutos` | `int`, `> 0` quando não nulo | M2 `ck_..._slaprimeiroatendimentominutos` |
 * | `slaIsento` | `boolean`, **incompatível** com meta preenchida | M2 `ck_..._slaisento` |
 * | `calendarioId` | `int` FK `calendarios` | M2 |
 * | `clientesVinculados` | read-only | §3 |
 */

/** Resposta de `GET /api/v1/support-plans` (envelope `ApiResponse<SupportPlanDto[]>`). */
export type SupportPlanDto = {
  id: number
  /** Rótulo. **Não é mais o identificador** — ver `hubspotValor` (arquitetura §3). */
  nome: string
  horasMes: number
  precoHoraExtra: number | null
  moeda: string
  isActive: boolean
  // ─── aditivos de 124 ───
  /** Chave estável do HubSpot. `null` = o vínculo cliente↔plano ainda casa por NOME. */
  hubspotValor: string | null
  /** `null` = herda `calendarios.slaPadraoMinutos`. */
  slaPrimeiroAtendimentoMinutos: number | null
  /** `true` = plano sem SLA de 1º atendimento (sai do denominador do indicador). */
  slaIsento: boolean
  /** `null` = calendário padrão. */
  calendarioId: number | null
  /** Read-only. Alimenta a guarda de rename (R-1) e a coluna da tabela. */
  clientesVinculados: number
}

/**
 * Corpo de `POST`/`PUT /api/v1/support-plans`.
 *
 * **R-10 (`arquitetura.md` §6): todo id é `number`, nunca `string`.** `calendarioId` e
 * `slaPrimeiroAtendimentoMinutos` nascem de `<select>`/`<input>`, que devolvem **string** —
 * a conversão é obrigatória e está em `toSupportPlanRequest`, coberta por teste sobre o
 * JSON **serializado** (não sobre o objeto em memória).
 */
export type SupportPlanRequest = {
  nome: string
  horasMes: number
  precoHoraExtra: number | null
  moeda: string
  hubspotValor: string | null
  slaPrimeiroAtendimentoMinutos: number | null
  slaIsento: boolean
  calendarioId: number | null
}

/** Item de `GET /api/v1/support-plans/unmatched` (arquitetura §3). */
export type UnmatchedPlanDto = {
  /** O texto que o HubSpot mandou e não casou com nenhum plano cadastrado. */
  valorHubspot: string
  clientesAfetados: number
  exemploClienteId: number | null
}

/** Opção de calendário para o seletor do plano (`GET /api/v1/calendars`, arquitetura §3). */
export type CalendarOptionDto = {
  id: number
  nome: string
  padrao: boolean
}

// ─────────────────────────────────────────────────────────────────────────────
// Limites — espelham o backend, que é a fonte de verdade
// ─────────────────────────────────────────────────────────────────────────────

/** `CreateSupportPlanValidator`/`UpdateSupportPlanValidator` → `MaximumLength(255)`. */
export const MAX_PLAN_NAME_LENGTH = 255

/** M1: `hubspotvalor varchar(255)`. */
export const MAX_HUBSPOT_VALUE_LENGTH = 255

/** `Moeda` → `Length(3)` (ISO 4217) nos dois validators. */
export const CURRENCY_CODE_LENGTH = 3

// ─────────────────────────────────────────────────────────────────────────────
// Parsing — UMA fonte para validar e para converter
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Converte texto digitado em número decimal. Aceita vírgula (pt-BR) e ponto.
 * Devolve `null` para vazio **e** para entrada não numérica — quem chama distingue os
 * dois casos pelo texto original (o schema exige não-vazio antes de exigir numérico).
 *
 * Esta função é usada **pelo schema Zod e pelo construtor do payload**. Uma segunda
 * rotina de parsing seria uma segunda fonte de verdade: schema aprovando "1,5" e payload
 * mandando `NaN` é exatamente o defeito que R-10 descreve.
 */
export function parseDecimalInput(raw: string): number | null {
  const texto = raw.trim().replace(',', '.')
  if (texto.length === 0) return null
  // Regex explícita: `Number('')`, `Number(' ')` e `Number('0x10')` são todos "válidos"
  // para o construtor e nenhum deles é um decimal digitado por um humano.
  if (!/^\d+(\.\d+)?$/.test(texto)) return null
  const valor = Number(texto)
  return Number.isFinite(valor) ? valor : null
}

/** Converte texto digitado em inteiro não negativo. `null` para vazio ou inválido. */
export function parseIntegerInput(raw: string): number | null {
  const texto = raw.trim()
  if (texto.length === 0) return null
  if (!/^\d+$/.test(texto)) return null
  const valor = Number(texto)
  return Number.isSafeInteger(valor) ? valor : null
}

// ─────────────────────────────────────────────────────────────────────────────
// Schema do formulário — fonte da verdade da validação (UX)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Todos os campos numéricos são **string** no formulário: é o que o DOM entrega, e
 * fingir o contrário (`valueAsNumber`) transforma campo vazio em `NaN` silencioso.
 * A conversão para o wire acontece em `toSupportPlanRequest`.
 */
export const supportPlanFormSchema = z
  .object({
    nome: z
      .string()
      .trim()
      .min(1, 'Informe o nome do plano.')
      .max(MAX_PLAN_NAME_LENGTH, `O nome deve ter no máximo ${MAX_PLAN_NAME_LENGTH} caracteres.`),
    horasMes: z
      .string()
      .trim()
      .min(1, 'Informe as horas mensais.')
      .refine((v): boolean => parseDecimalInput(v) !== null, 'Informe um número válido.')
      .refine((v): boolean => (parseDecimalInput(v) ?? 0) > 0, 'As horas mensais devem ser maiores que zero.'),
    precoHoraExtra: z
      .string()
      .trim()
      .refine(
        (v): boolean => v.length === 0 || parseDecimalInput(v) !== null,
        'Informe um número válido ou deixe em branco.',
      ),
    moeda: z
      .string()
      .trim()
      .length(CURRENCY_CODE_LENGTH, `A moeda deve ter exatamente ${CURRENCY_CODE_LENGTH} letras (ISO 4217).`)
      .regex(/^[A-Za-z]{3}$/, 'A moeda deve ter exatamente 3 letras (ISO 4217).'),
    hubspotValor: z
      .string()
      .trim()
      .max(
        MAX_HUBSPOT_VALUE_LENGTH,
        `O identificador deve ter no máximo ${MAX_HUBSPOT_VALUE_LENGTH} caracteres.`,
      ),
    slaPrimeiroAtendimentoMinutos: z
      .string()
      .trim()
      .refine(
        (v): boolean => v.length === 0 || parseIntegerInput(v) !== null,
        'Informe um número inteiro de minutos ou deixe em branco.',
      )
      .refine(
        (v): boolean => v.length === 0 || (parseIntegerInput(v) ?? 0) > 0,
        'A meta deve ser maior que zero.',
      ),
    slaIsento: z.boolean(),
    /** `''` = "calendário padrão" (envia `calendarioId: null`). */
    calendarioId: z.string(),
  })
  // M2 `ck_suporte_supportplans_slaisento`: isento E meta preenchida é estado proibido no
  // banco. Sem esta trava o usuário só descobre pelo `422 PLAN_SLA_CONFLICT`.
  // `: boolean` explícito — AP-FRONTEND-023 (type guard inferido quebra o Resolver do RHF).
  .refine(
    (v): boolean => !(v.slaIsento && v.slaPrimeiroAtendimentoMinutos.trim().length > 0),
    {
      path: ['slaPrimeiroAtendimentoMinutos'],
      message: 'Plano isento não pode ter meta de 1º atendimento. Limpe o campo ou desmarque a isenção.',
    },
  )

export type SupportPlanFormValues = z.infer<typeof supportPlanFormSchema>

/**
 * Valores iniciais do formulário a partir do plano (ou do "novo plano").
 * Campo nulo vira **string vazia** — nunca `'null'`/`'undefined'` renderizados no input.
 *
 * `hubspotValorInicial` só vale na CRIAÇÃO: é o caminho "criar o plano que falta" a
 * partir do card de planos do HubSpot sem correspondência, com o valor que não casou já
 * preenchido. Na edição o valor vem do próprio plano — o do card não pode sobrescrevê-lo.
 */
export function toSupportPlanFormValues(
  plan: SupportPlanDto | null,
  hubspotValorInicial = '',
): SupportPlanFormValues {
  if (plan == null) {
    return {
      nome: '',
      horasMes: '',
      precoHoraExtra: '',
      // Default do backend em `CreateSupportPlanDto` (`SupportPlanDtos.cs:14`).
      moeda: 'BRL',
      hubspotValor: hubspotValorInicial,
      slaPrimeiroAtendimentoMinutos: '',
      slaIsento: false,
      calendarioId: '',
    }
  }
  return {
    nome: plan.nome,
    horasMes: String(plan.horasMes),
    // `== null` cobre null E ausência do campo — AP-FRONTEND-028.
    precoHoraExtra: plan.precoHoraExtra == null ? '' : String(plan.precoHoraExtra),
    moeda: plan.moeda,
    hubspotValor: plan.hubspotValor ?? '',
    slaPrimeiroAtendimentoMinutos:
      plan.slaPrimeiroAtendimentoMinutos == null ? '' : String(plan.slaPrimeiroAtendimentoMinutos),
    slaIsento: plan.slaIsento,
    calendarioId: plan.calendarioId == null ? '' : String(plan.calendarioId),
  }
}

/**
 * Constrói o corpo do request a partir dos valores validados.
 *
 * **R-10 vive aqui.** `calendarioId` e `slaPrimeiroAtendimentoMinutos` saem de controles
 * que devolvem string; mandá-los como `"3"` produz `400` de model binding
 * (`System.Text.Json` não converte string em `int`), mascarado por toast genérico.
 * O teste companheiro serializa com `JSON.stringify` e afirma o **tipo no wire**.
 */
export function toSupportPlanRequest(values: SupportPlanFormValues): SupportPlanRequest {
  const hubspotValor = values.hubspotValor.trim()
  return {
    nome: values.nome.trim(),
    horasMes: parseDecimalInput(values.horasMes) ?? 0,
    precoHoraExtra: parseDecimalInput(values.precoHoraExtra),
    moeda: values.moeda.trim().toUpperCase(),
    // Campo vazio = "sem identificador" = `null`, nunca `""`. O índice único é sobre
    // `lower(hubspotvalor)` (M1): dois planos com `""` colidiriam; com `NULL`, não.
    hubspotValor: hubspotValor.length > 0 ? hubspotValor : null,
    slaPrimeiroAtendimentoMinutos: values.slaIsento
      ? null
      : parseIntegerInput(values.slaPrimeiroAtendimentoMinutos),
    slaIsento: values.slaIsento,
    calendarioId: parseIntegerInput(values.calendarioId),
  }
}
