import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '../../../components/ui/Toast'
import {
  createCalendar,
  createSchedule,
  updateCalendar,
} from '../services/businessCalendarService'
import type {
  CalendarDto,
  CalendarRequest,
  CreateScheduleRequest,
  ScheduleDto,
} from '../types/calendar'
import { getCalendarErrorMessage } from '../utils/calendarErrorMessage'
import { CALENDARS_QUERY_KEY, scheduleQueryKey } from './useBusinessCalendar'

/**
 * 124/F2 — mutações de calendário e de expediente.
 *
 * O `onError` usa `getCalendarErrorMessage` (nunca `handleApiError` cru): é ele que
 * transforma `409 CALENDAR_LAST_DEFAULT` e `422 SCHEDULE_VIGENCIA_DUPLICADA` em
 * mensagem que diz **o que fazer**.
 *
 * **Invalidação por prefixo `['calendars']`** — alcança a lista, o expediente, os
 * feriados e o seletor de calendário da tela de planos (`['calendars','options']`, de
 * `FE-F1`). Ver o comentário de `useBusinessCalendar.ts`.
 */
export type UpdateCalendarVariables = { id: number; payload: CalendarRequest }
export type CreateScheduleVariables = { calendarId: number; payload: CreateScheduleRequest }

export function useCalendarMutations() {
  const queryClient = useQueryClient()
  const toast = useToast()

  function invalidarCalendarios() {
    queryClient.invalidateQueries({ queryKey: CALENDARS_QUERY_KEY })
  }

  const create = useMutation<CalendarDto, unknown, CalendarRequest>({
    mutationFn: (payload) => createCalendar(payload),
    onSuccess: () => {
      toast.success('Calendário criado.')
      invalidarCalendarios()
    },
    onError: (error: unknown) => toast.error(getCalendarErrorMessage(error)),
  })

  const update = useMutation<CalendarDto, unknown, UpdateCalendarVariables>({
    mutationFn: ({ id, payload }) => updateCalendar(id, payload),
    onSuccess: () => {
      toast.success('Calendário atualizado.')
      invalidarCalendarios()
    },
    onError: (error: unknown) => toast.error(getCalendarErrorMessage(error)),
  })

  const salvarExpediente = useMutation<ScheduleDto, unknown, CreateScheduleVariables>({
    mutationFn: ({ calendarId, payload }) => createSchedule(calendarId, payload),
    onSuccess: (_resultado, variaveis) => {
      // A frase diz o que ACONTECEU (nova versão), não "salvo": editar a grade não
      // reescreve o passado, e o usuário precisa saber disso (A-5).
      toast.success('Nova vigência de expediente criada.')
      queryClient.invalidateQueries({ queryKey: scheduleQueryKey(variaveis.calendarId) })
      invalidarCalendarios()
    },
    onError: (error: unknown) => toast.error(getCalendarErrorMessage(error)),
  })

  return { create, update, salvarExpediente }
}
