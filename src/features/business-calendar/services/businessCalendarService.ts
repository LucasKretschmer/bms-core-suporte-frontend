import { api } from '../../../services/api'
import type { ApiResponse, PaginatedResponse } from '../../../types/api'
import type {
  CalendarDto,
  CalendarRequest,
  CreateScheduleRequest,
  HolidayDto,
  HolidayImpactDto,
  HolidayRequest,
  ImportHolidayItem,
  ImportHolidaysResultDto,
  ScheduleDto,
} from '../types/calendar'

/**
 * 124/F2+F3 — serviços de calendário comercial, expediente e feriados.
 *
 * Contrato lido em `Suporte.API/Controllers/CalendarsController.cs` e
 * `HolidaysController.cs` (o `be-f2f3-report.md` ainda não existia):
 *
 * ```
 * GET    /api/v1/calendars                                   [CoordenadorPlus] ApiResponse<CalendarDto[]>
 * POST   /api/v1/calendars                                   [GerentePlus]     201 ApiResponse<CalendarDto>
 * PUT    /api/v1/calendars/{id}                              [GerentePlus]     ApiResponse<CalendarDto>
 * GET    /api/v1/calendars/{id}/schedule                     [CoordenadorPlus] ApiResponse<ScheduleDto>
 * POST   /api/v1/calendars/{id}/schedule                     [GerentePlus]     ApiResponse<ScheduleDto>
 * GET    /api/v1/calendars/{id}/holidays?ano&page&pageSize   [CoordenadorPlus] ApiResponse<PaginatedResponse<HolidayDto>>
 * GET    /api/v1/calendars/{id}/holidays/impacto?data        [CoordenadorPlus] ApiResponse<HolidayImpactDto>
 * POST   /api/v1/calendars/{id}/holidays                     [GerentePlus]     201 ApiResponse<HolidayDto>
 * PUT    /api/v1/calendars/{id}/holidays/{hid}               [GerentePlus]     ApiResponse<HolidayDto>
 * DELETE /api/v1/calendars/{id}/holidays/{hid}               [GerentePlus]     200 ApiResponse<HolidayDto>  ← 200 com corpo, não 204
 * POST   /api/v1/calendars/{id}/holidays/import?dryRun       [GerentePlus]     ApiResponse<ImportHolidaysResultDto>
 * ```
 *
 * `DELETE /api/v1/calendars/{id}` existe (`AdminOnly`) e **não é consumido** por esta
 * tela — mesma leitura conservadora do `DELETE` de planos em `FE-F1`.
 *
 * ## R-7 — array na query
 *
 * Nenhum filtro desta tela é array hoje (`ano` é escalar). A instância `api` já serializa
 * arrays no formato que o ASP.NET liga (`paramsSerializer: { indexes: null }`,
 * `services/api.ts:41`, verificado). O teste companheiro trava o **wire real**: o objeto
 * `params` enviado, e a ausência da chave `ano` quando não há filtro — para que um filtro
 * futuro seja decisão consciente, e não um `?anos[]=` que o ASP.NET ignora em silêncio.
 *
 * ## R-10 — id é `number`
 *
 * Todo id vai para a URL a partir de um `number` tipado, e todo campo numérico do corpo é
 * convertido **antes** do request (`toCalendarRequest`, `validarGrade`). O teste
 * companheiro afirma o tipo sobre o **JSON serializado**, nunca sobre o objeto em memória.
 */

const BASE = '/api/v1/calendars'

// ─── Calendários ─────────────────────────────────────────────────────────────

export async function listCalendars(): Promise<CalendarDto[]> {
  const { data } = await api.get<ApiResponse<CalendarDto[]>>(BASE)
  return data.data
}

export async function createCalendar(payload: CalendarRequest): Promise<CalendarDto> {
  const { data } = await api.post<ApiResponse<CalendarDto>>(BASE, payload)
  return data.data
}

export async function updateCalendar(
  id: number,
  payload: CalendarRequest,
): Promise<CalendarDto> {
  const { data } = await api.put<ApiResponse<CalendarDto>>(`${BASE}/${id}`, payload)
  return data.data
}

// ─── Expediente ──────────────────────────────────────────────────────────────

export async function getSchedule(calendarId: number): Promise<ScheduleDto> {
  const { data } = await api.get<ApiResponse<ScheduleDto>>(`${BASE}/${calendarId}/schedule`)
  return data.data
}

/** Cria uma **nova vigência** — nunca edita a anterior (A-5). */
export async function createSchedule(
  calendarId: number,
  payload: CreateScheduleRequest,
): Promise<ScheduleDto> {
  const { data } = await api.post<ApiResponse<ScheduleDto>>(
    `${BASE}/${calendarId}/schedule`,
    payload,
  )
  return data.data
}

// ─── Feriados ────────────────────────────────────────────────────────────────

export type ListHolidaysParams = {
  /** Filtro por ano (escalar). Ausente = todos os anos. */
  ano?: number | null
  page: number
  pageSize: number
}

export async function listHolidays(
  calendarId: number,
  params: ListHolidaysParams,
): Promise<PaginatedResponse<HolidayDto>> {
  const { data } = await api.get<ApiResponse<PaginatedResponse<HolidayDto>>>(
    `${BASE}/${calendarId}/holidays`,
    {
      params: {
        // `ano` só entra no wire quando há filtro: mandar `ano=null` faria o ASP.NET
        // receber a string "null" e devolver 400 de model binding.
        ...(params.ano == null ? {} : { ano: params.ano }),
        page: params.page,
        pageSize: params.pageSize,
      },
    },
  )
  return data.data
}

/**
 * **Pré-contagem de impacto** (§1.4 do `be-f2f3-report.md`) — o número que DD-2 exige **antes**
 * da escrita.
 *
 * `data` é `AAAA-MM-DD` estrito e passa pelas **mesmas** regras do `POST` (formato e faixa de
 * ±10 anos): mostrar um número para uma data que a escrita vai recusar seria pior que não
 * mostrar. Respostas de erro: `404` (calendário inexistente) e `422 VALIDATION_ERROR` com
 * `details[0].field === "data"`.
 *
 * Não tem efeito colateral nenhum no servidor — nem cria feriado, nem grava auditoria.
 */
export async function getHolidayImpact(
  calendarId: number,
  data: string,
): Promise<HolidayImpactDto> {
  const { data: corpo } = await api.get<ApiResponse<HolidayImpactDto>>(
    `${BASE}/${calendarId}/holidays/impacto`,
    { params: { data } },
  )
  return corpo.data
}

export async function createHoliday(
  calendarId: number,
  payload: HolidayRequest,
): Promise<HolidayDto> {
  const { data } = await api.post<ApiResponse<HolidayDto>>(
    `${BASE}/${calendarId}/holidays`,
    payload,
  )
  return data.data
}

export async function updateHoliday(
  calendarId: number,
  holidayId: number,
  payload: HolidayRequest,
): Promise<HolidayDto> {
  const { data } = await api.put<ApiResponse<HolidayDto>>(
    `${BASE}/${calendarId}/holidays/${holidayId}`,
    payload,
  )
  return data.data
}

/**
 * Remove o feriado. **Responde 200 com corpo** (não 204): o corpo traz
 * `avisoRetroativo`/`ticketsFechadosNoDia`, que é o número que a tela exibe depois de
 * mexer no passado (DD-2).
 */
export async function deleteHoliday(
  calendarId: number,
  holidayId: number,
): Promise<HolidayDto> {
  const { data } = await api.delete<ApiResponse<HolidayDto>>(
    `${BASE}/${calendarId}/holidays/${holidayId}`,
  )
  return data.data
}

/**
 * Importa feriados **já parseados pelo navegador** (A-8): o corpo é JSON, nunca arquivo.
 *
 * `dryRun=true` calcula os números sem gravar — é a pré-visualização obrigatória
 * (AUTO-124-9). Linha inválida recusa o lote inteiro com `422 IMPORT_INVALID_ROWS` e
 * `details[]` linha a linha.
 */
export async function importHolidays(
  calendarId: number,
  itens: ImportHolidayItem[],
  dryRun: boolean,
): Promise<ImportHolidaysResultDto> {
  const { data } = await api.post<ApiResponse<ImportHolidaysResultDto>>(
    `${BASE}/${calendarId}/holidays/import`,
    { itens },
    { params: { dryRun } },
  )
  return data.data
}
