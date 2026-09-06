import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react'
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockToastSuccess,
  mockToastError,
  mockInvalidateQueries,
  mockCreate,
  mockUpdate,
  mockDelete,
  mockImport,
} = vi.hoisted(() => ({
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
  mockInvalidateQueries: vi.fn(),
  mockCreate: vi.fn(),
  mockUpdate: vi.fn(),
  mockDelete: vi.fn(),
  mockImport: vi.fn(),
}))

vi.mock('../../../components/ui/Toast', () => ({
  useToast: () => ({ success: mockToastSuccess, error: mockToastError, info: vi.fn() }),
}))

vi.mock('../services/businessCalendarService', () => ({
  createHoliday: mockCreate,
  updateHoliday: mockUpdate,
  deleteHoliday: mockDelete,
  importHolidays: mockImport,
}))

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>()
  return { ...actual, useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }) }
})

import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios'
import { useHolidayMutations } from './useHolidayMutations'

function erroApi(status: number, code: string, message: string): AxiosError {
  const config = { headers: new AxiosHeaders() }
  const response: AxiosResponse = {
    data: { error: { code, message } },
    status,
    statusText: '',
    headers: {},
    config,
  }
  return new AxiosError(`Request failed with status code ${status}`, undefined, config, {}, response)
}

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return React.createElement(QueryClientProvider, { client }, children)
}

describe('useHolidayMutations', () => {
  beforeEach(() => vi.clearAllMocks())

  it('create: toast de sucesso e invalidação pelo prefixo ["calendars"]', async () => {
    mockCreate.mockResolvedValueOnce({ id: 1, data: '2026-12-25', nome: 'Natal' })
    const { result } = renderHook(() => useHolidayMutations(), { wrapper })

    await act(async () => {
      await result.current.create.mutateAsync({
        calendarId: 3,
        payload: { data: '2026-12-25', nome: 'Natal' },
      })
    })

    expect(mockCreate).toHaveBeenCalledWith(3, { data: '2026-12-25', nome: 'Natal' })
    expect(mockToastSuccess).toHaveBeenCalledWith('Feriado cadastrado.')
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['calendars'] })
  })

  it('remove: devolve o corpo (com o aviso DD-2) e invalida', async () => {
    mockDelete.mockResolvedValueOnce({
      id: 1,
      data: '2026-03-04',
      nome: 'Carnaval',
      avisoRetroativo: true,
      ticketsFechadosNoDia: 12,
    })
    const { result } = renderHook(() => useHolidayMutations(), { wrapper })

    const removido = await act(async () =>
      result.current.remove.mutateAsync({ calendarId: 3, holidayId: 1 }),
    )

    expect(removido.ticketsFechadosNoDia).toBe(12)
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['calendars'] })
  })

  it('erro de mutação vira mensagem acionável, não o toast genérico', async () => {
    mockUpdate.mockRejectedValueOnce(
      erroApi(409, 'HOLIDAY_DATE_DUPLICATE', 'Já existe um feriado nesta data.'),
    )
    const { result } = renderHook(() => useHolidayMutations(), { wrapper })

    await act(async () => {
      await result.current.update
        .mutateAsync({ calendarId: 3, holidayId: 1, payload: { data: 'x', nome: 'y' } })
        .catch(() => undefined)
    })

    expect(mockToastError).toHaveBeenCalledWith(
      'Já existe um feriado nesta data. Edite o feriado que já existe nessa data.',
    )
  })

  it('importação com dryRun NÃO invalida nem dá toast — simulação não gravou nada', async () => {
    mockImport.mockResolvedValueOnce({
      total: 3,
      criados: 3,
      atualizados: 0,
      inalterados: 0,
      dryRun: true,
    })
    const { result } = renderHook(() => useHolidayMutations(), { wrapper })

    await act(async () => {
      await result.current.importar.mutateAsync({ calendarId: 3, itens: [], dryRun: true })
    })

    expect(mockImport).toHaveBeenCalledWith(3, [], true)
    expect(mockToastSuccess).not.toHaveBeenCalled()
    expect(mockInvalidateQueries).not.toHaveBeenCalled()
  })

  it('importação REAL invalida e informa os três números — companheira positiva do dryRun', async () => {
    mockImport.mockResolvedValueOnce({
      total: 3,
      criados: 2,
      atualizados: 1,
      inalterados: 0,
      dryRun: false,
    })
    const { result } = renderHook(() => useHolidayMutations(), { wrapper })

    await act(async () => {
      await result.current.importar.mutateAsync({ calendarId: 3, itens: [], dryRun: false })
    })

    expect(mockToastSuccess).toHaveBeenCalledWith(
      'Importação concluída: 2 criado(s), 1 atualizado(s), 0 inalterado(s).',
    )
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['calendars'] })
  })

  it('erro da importação NÃO vira toast — o relatório linha a linha é da tela', async () => {
    mockImport.mockRejectedValueOnce(
      erroApi(422, 'IMPORT_INVALID_ROWS', 'A importação foi recusada por inteiro.'),
    )
    const { result } = renderHook(() => useHolidayMutations(), { wrapper })

    await act(async () => {
      await result.current.importar
        .mutateAsync({ calendarId: 3, itens: [], dryRun: true })
        .catch(() => undefined)
    })

    // Um toast genérico aqui jogaria fora os `details[]` que o usuário precisa ver.
    expect(mockToastError).not.toHaveBeenCalled()
  })
})
