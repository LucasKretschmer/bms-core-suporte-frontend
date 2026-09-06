import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '../../../components/ui/Toast'
import {
  createHoliday,
  deleteHoliday,
  importHolidays,
  updateHoliday,
} from '../services/businessCalendarService'
import type {
  HolidayDto,
  HolidayRequest,
  ImportHolidayItem,
  ImportHolidaysResultDto,
} from '../types/calendar'
import { getCalendarErrorMessage } from '../utils/calendarErrorMessage'
import { CALENDARS_QUERY_KEY } from './useBusinessCalendar'

/**
 * 124/F3 — mutações de feriado (CRUD + importação).
 *
 * ## Invalidação
 *
 * Feriado mexe no cálculo de SLA, mas os KPIs de SLA são de `BE-F4F5` (onda 3) e ainda
 * não estão vivos — não há chave de métrica para invalidar hoje. O que existe é a
 * listagem de feriados, e ela é invalidada pelo **prefixo** `['calendars']`, que alcança
 * todas as páginas/filtros de `['calendars', id, 'holidays', params]` de uma vez. Sem o
 * prefixo, importar 15 feriados deixaria a página aberta mostrando a lista antiga.
 *
 * ## `dryRun` NÃO invalida nada
 *
 * A simulação não grava (é o que a torna pré-visualização). Invalidar depois dela
 * mandaria a tela recarregar uma lista que não mudou — e, pior, sugeriria que mudou.
 */
export type HolidayVariables = { calendarId: number; payload: HolidayRequest }
export type UpdateHolidayVariables = HolidayVariables & { holidayId: number }
export type DeleteHolidayVariables = { calendarId: number; holidayId: number }
export type ImportVariables = {
  calendarId: number
  itens: ImportHolidayItem[]
  dryRun: boolean
}

export function useHolidayMutations() {
  const queryClient = useQueryClient()
  const toast = useToast()

  function invalidar() {
    queryClient.invalidateQueries({ queryKey: CALENDARS_QUERY_KEY })
  }

  const create = useMutation<HolidayDto, unknown, HolidayVariables>({
    mutationFn: ({ calendarId, payload }) => createHoliday(calendarId, payload),
    onSuccess: () => {
      toast.success('Feriado cadastrado.')
      invalidar()
    },
    onError: (error: unknown) => toast.error(getCalendarErrorMessage(error)),
  })

  const update = useMutation<HolidayDto, unknown, UpdateHolidayVariables>({
    mutationFn: ({ calendarId, holidayId, payload }) =>
      updateHoliday(calendarId, holidayId, payload),
    onSuccess: () => {
      toast.success('Feriado atualizado.')
      invalidar()
    },
    onError: (error: unknown) => toast.error(getCalendarErrorMessage(error)),
  })

  const remove = useMutation<HolidayDto, unknown, DeleteHolidayVariables>({
    mutationFn: ({ calendarId, holidayId }) => deleteHoliday(calendarId, holidayId),
    onSuccess: () => {
      toast.success('Feriado removido.')
      invalidar()
    },
    onError: (error: unknown) => toast.error(getCalendarErrorMessage(error)),
  })

  /**
   * Importação. **Não** mostra toast de erro: o `422 IMPORT_INVALID_ROWS` traz
   * `details[]` linha a linha, e um toast genérico jogaria fora exatamente a informação
   * que o usuário precisa para corrigir a planilha (AUTO-124-9). Quem chama renderiza
   * o relatório e decide.
   */
  const importar = useMutation<ImportHolidaysResultDto, unknown, ImportVariables>({
    mutationFn: ({ calendarId, itens, dryRun }) => importHolidays(calendarId, itens, dryRun),
    onSuccess: (resultado) => {
      if (resultado.dryRun) return
      toast.success(
        `Importação concluída: ${resultado.criados} criado(s), ` +
          `${resultado.atualizados} atualizado(s), ${resultado.inalterados} inalterado(s).`,
      )
      invalidar()
    },
  })

  return { create, update, remove, importar }
}
