import { z } from 'zod'
import type { DiaSemana } from '../utils/weekday'
import { faixaAceitaDeFeriado } from '../utils/localDay'

/**
 * 124/F2+F3 — contrato do calendário comercial, expediente e feriados.
 *
 * ## De onde vem cada campo
 *
 * O `be-f2f3-report.md` **não existia** quando esta unidade foi escrita (a unidade de
 * backend correspondente rodava em paralelo). O contrato abaixo foi então lido **no
 * código do backend**, que é evidência mais forte que o documento preliminar:
 *
 * | Peça | Arquivo lido |
 * |---|---|
 * | `CalendarDto`, `Create/UpdateCalendarDto`, `ScheduleWindowDto`, `ScheduleDto`, `CreateScheduleDto` | `Suporte.Application/DTOs/Config/CalendarDtos.cs` |
 * | `HolidayDto`, `Create/UpdateHolidayDto`, `ImportHolidaysDto`, `ImportHolidaysResultDto` | `Suporte.Application/DTOs/Config/HolidayDtos.cs` |
 * | Rotas, policies e status | `Suporte.API/Controllers/CalendarsController.cs`, `HolidaysController.cs` |
 * | Limites (500 itens, ±10 anos, pageSize 200) | `Services/Config/HolidayService.cs:26-38` |
 * | `error.code` | `Suporte.Domain/Config/CalendarioConflitos.cs` |
 *
 * Onde o código diverge da `arquitetura.md` §3, **o código venceu** e a divergência está
 * registrada no relatório da unidade (`fe-f2f3-report.md` §8).
 */

// ─────────────────────────────────────────────────────────────────────────────
// Calendário
// ─────────────────────────────────────────────────────────────────────────────

/** `GET /api/v1/calendars` → `ApiResponse<CalendarDto[]>`. */
export type CalendarDto = {
  id: number
  /** "Padrão", "24/7". Único entre os ativos (case-insensitive). */
  nome: string
  /** No máximo **um** calendário ativo é padrão. Despromover o último é `409`. */
  padrao: boolean
  /** `true` em calendário 24/7: os feriados não são descontados. */
  ignorarFeriados: boolean
  /**
   * Meta global de 1º atendimento. **Não configurado** ⇒ SLA responde `null`.
   *
   * 129 — opcional porque `WhenWritingNull` **omite a chave** quando o backend escreve
   * nulo (`CalendarDto.SlaPadraoMinutos` é `int?`). Guard: `== null`.
   */
  slaPadraoMinutos?: number | null
}

/** Corpo de `POST`/`PUT /api/v1/calendars` — idênticos (substituição total). */
export type CalendarRequest = {
  nome: string
  padrao: boolean
  ignorarFeriados: boolean
  slaPadraoMinutos: number | null
}

// ─────────────────────────────────────────────────────────────────────────────
// Expediente (versionado por vigência — A-5)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Uma janela de expediente dentro de um dia da semana.
 *
 * `diaSemana` é `DiaSemana` (**0 = domingo**, ver `utils/weekday.ts`) e
 * `inicioMinuto`/`fimMinuto` são **minutos desde a meia-noite, 0..1440**
 * (ver `utils/minutes.ts`). Fronteira half-open `[inicio, fim)`; `fim > inicio` é
 * invariante do banco (DD-5).
 */
export type ScheduleWindowDto = {
  diaSemana: DiaSemana
  inicioMinuto: number
  fimMinuto: number
}

export type ScheduleVersionDto = {
  id: number
  /** `AAAA-MM-DD`, dia local SP. */
  vigenciaInicio: string
  janelasCount: number
}

export type ScheduleCurrentDto = {
  id: number
  vigenciaInicio: string
  janelas: ScheduleWindowDto[]
}

/**
 * `GET /api/v1/calendars/{id}/schedule`.
 *
 * `vigente` é **"não configurado"** quando o calendário ainda não tem versão em vigor —
 * inclusive quando só existem versões **futuras**. É estado válido, não erro (D-5).
 *
 * 🔴 **129 — o campo é OPCIONAL no wire, não `null`.** O backend serializa com
 * `DefaultIgnoreCondition = WhenWritingNull` (`Suporte.API/Program.cs:211-214`), e
 * `ScheduleDto.Vigente` é `ScheduleCurrentDto?` (`CalendarDtos.cs:81-83`): quando não há
 * versão em vigor a **chave não vem no JSON**. Declarar só `| null` fazia `vigente === null`
 * ser **falso** para `undefined`, o ramo "tem expediente" rodar, e a tela estourar com
 * `Cannot read properties of undefined (reading 'vigenciaInicio')` em todo calendário
 * recém-criado. O tipo declara as duas formas e **todo guard é `== null`** — nunca `=== null`.
 */
export type ScheduleDto = {
  vigente?: ScheduleCurrentDto | null
  /** Todas as versões ativas, da mais recente para a mais antiga. */
  versoes: ScheduleVersionDto[]
}

/**
 * Corpo de `POST /api/v1/calendars/{id}/schedule` — cria **nova vigência**, nunca
 * edita a anterior. `janelas: []` é estado válido: "expediente desligado a partir
 * daquela data".
 */
export type CreateScheduleRequest = {
  vigenciaInicio: string
  janelas: ScheduleWindowDto[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Feriados
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Item de `GET /calendars/{id}/holidays` (dentro de `PaginatedResponse`) e resposta das
 * mutações.
 *
 * `avisoRetroativo`/`ticketsFechadosNoDia` só vêm nas respostas de **POST/PUT/DELETE**
 * (`HolidayDtos.cs`): na listagem saem `null` e o serializador os omite. São a matéria
 * de DD-2 — mexer em feriado passado muda indicador já apurado.
 */
export type HolidayDto = {
  id: number
  /** `AAAA-MM-DD`, dia local SP. */
  data: string
  nome: string
  avisoRetroativo?: boolean | null
  ticketsFechadosNoDia?: number | null
}

/** Corpo de `POST`/`PUT` de feriado. */
export type HolidayRequest = {
  data: string
  nome: string
}

/**
 * `GET /api/v1/calendars/{cid}/holidays/impacto?data=AAAA-MM-DD` (§1.4 do `be-f2f3-report.md`).
 *
 * É a **pré-contagem** que DD-2 exige: o número de chamados afetados **antes** da escrita.
 * Sem ela, a tela só podia avisar por data e mostrar a contagem depois do fato.
 *
 * ⚠️ `ticketsFechadosNoDia` vem **0 quando a data não é retroativa**, e isso é regra, não
 * bug: `avisoRetroativo` é `data <= hoje` (dia local SP) desde a decisão `P-6`, então o `0`
 * desse caso significa *"esta data está no futuro"*, e **não** *"verifiquei e não há
 * impacto"*. Quem monta o texto (`utils/retroactiveWarning.ts`) não exibe o número quando
 * `avisoRetroativo === false`.
 *
 * 🔴 **Este campo é a fonte ÚNICA do que a tela afirma sobre retroatividade.** O predicado
 * local (`utils/localDay.ts::ehDiaRetroativo`) só decide se **há o que perguntar** — nenhuma
 * frase é montada a partir dele.
 */
export type HolidayImpactDto = {
  /** Eco da data consultada, normalizada. */
  data: string
  /**
   * `true` quando `data <= hoje` (dia local SP) — a mesma regra da resposta de mutação, e a
   * mesma fronteira de `HolidayService.CalcularImpactoAsync` depois de `P-6`. **Hoje conta:**
   * chamado fechado hoje de manhã já tem indicador apurado, e cadastrar hoje como feriado à
   * tarde o altera.
   */
  avisoRetroativo: boolean
  /** Mesmo número que a mutação devolveria para esta data (o backend usa a mesma função). */
  ticketsFechadosNoDia: number
}

/** Uma linha do arquivo, já parseada **pelo navegador** (A-8: o backend recebe JSON). */
export type ImportHolidayItem = {
  data: string
  nome: string
}

export type ImportHolidaysRequest = {
  itens: ImportHolidayItem[]
}

/**
 * Resultado da importação. Com `dryRun=true` os mesmos números são calculados sem
 * gravar — é o que a pré-visualização obrigatória (AUTO-124-9) usa.
 */
export type ImportHolidaysResultDto = {
  total: number
  criados: number
  atualizados: number
  /** Reimportar o mesmo arquivo ⇒ `criados: 0, atualizados: 0, inalterados: N`. */
  inalterados: number
  dryRun: boolean
}

// ─────────────────────────────────────────────────────────────────────────────
// Limites — espelham o backend, que é a fonte de verdade
// ─────────────────────────────────────────────────────────────────────────────

/** `calendarios.nome varchar(120)` (M3) e `CalendarService` ("no máximo 120"). */
export const MAX_NOME_CALENDARIO = 120

/** `feriados.nome varchar(120)` (M3) e `HolidayService.ExigirNome`. */
export const MAX_NOME_FERIADO = 120

/** `HolidayService.MaxItensImportacao` — `422 IMPORT_TOO_MANY_ROWS` acima disso. */
export const MAX_ITENS_IMPORTACAO = 500

/** `HolidayService.PageSizePadrao`. */
export const PAGE_SIZE_PADRAO = 50

/** `HolidayService.MaxPageSize` — o cap também é aplicado no servidor. */
export const MAX_PAGE_SIZE = 200

// ─────────────────────────────────────────────────────────────────────────────
// Schemas de formulário (fonte da verdade da validação de UX)
// ─────────────────────────────────────────────────────────────────────────────

/** Inteiro positivo digitado, ou `null` para campo vazio/inválido. */
export function parseMinutosInput(bruto: string): number | null {
  const texto = bruto.trim()
  if (texto.length === 0) return null
  if (!/^\d+$/.test(texto)) return null
  const valor = Number(texto)
  return Number.isSafeInteger(valor) ? valor : null
}

/**
 * Formulário de calendário. Campos numéricos são **string** — é o que o DOM entrega;
 * a conversão para o wire mora em `toCalendarRequest` (R-10).
 */
export const calendarFormSchema = z.object({
  nome: z
    .string()
    .trim()
    .min(1, 'Informe o nome do calendário.')
    .max(MAX_NOME_CALENDARIO, `O nome deve ter no máximo ${MAX_NOME_CALENDARIO} caracteres.`),
  padrao: z.boolean(),
  ignorarFeriados: z.boolean(),
  slaPadraoMinutos: z
    .string()
    .trim()
    .refine(
      (v): boolean => v.length === 0 || parseMinutosInput(v) !== null,
      'Informe um número inteiro de minutos ou deixe em branco.',
    )
    .refine(
      (v): boolean => v.length === 0 || (parseMinutosInput(v) ?? 0) > 0,
      'A meta deve ser maior que zero.',
    ),
})

export type CalendarFormValues = z.infer<typeof calendarFormSchema>

export function toCalendarFormValues(calendario: CalendarDto | null): CalendarFormValues {
  if (calendario == null) {
    return { nome: '', padrao: false, ignorarFeriados: false, slaPadraoMinutos: '' }
  }
  return {
    nome: calendario.nome,
    padrao: calendario.padrao,
    ignorarFeriados: calendario.ignorarFeriados,
    // `== null` cobre null E ausência do campo (AP-FRONTEND-028).
    slaPadraoMinutos:
      calendario.slaPadraoMinutos == null ? '' : String(calendario.slaPadraoMinutos),
  }
}

/**
 * **R-10 vive aqui.** `slaPadraoMinutos` sai de um `<input>` (string). Enviá-lo como
 * `"30"` produz `400` de model binding (`System.Text.Json` não converte string em
 * `int?`), mascarado por toast genérico. O teste companheiro serializa com
 * `JSON.stringify` e afirma o **tipo no wire**.
 */
export function toCalendarRequest(values: CalendarFormValues): CalendarRequest {
  return {
    nome: values.nome.trim(),
    padrao: values.padrao,
    ignorarFeriados: values.ignorarFeriados,
    slaPadraoMinutos: parseMinutosInput(values.slaPadraoMinutos),
  }
}

/**
 * Formulário de feriado. A faixa de ±10 anos é a **mesma** do backend
 * (`HolidayService.AnosParaTras/AnosParaFrente`), calculada sobre o dia local SP.
 */
export const holidayFormSchema = z.object({
  data: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve estar no formato AAAA-MM-DD.')
    .refine((v): boolean => {
      const { minimo, maximo } = faixaAceitaDeFeriado()
      return v >= minimo && v <= maximo
    }, 'Data fora da faixa aceita (10 anos para trás e 10 para frente).'),
  nome: z
    .string()
    .trim()
    .min(1, 'Informe o nome do feriado.')
    .max(MAX_NOME_FERIADO, `O nome deve ter no máximo ${MAX_NOME_FERIADO} caracteres.`),
})

export type HolidayFormValues = z.infer<typeof holidayFormSchema>

export function toHolidayFormValues(feriado: HolidayDto | null): HolidayFormValues {
  if (feriado == null) return { data: '', nome: '' }
  return { data: feriado.data, nome: feriado.nome }
}

export function toHolidayRequest(values: HolidayFormValues): HolidayRequest {
  return { data: values.data.trim(), nome: values.nome.trim() }
}
