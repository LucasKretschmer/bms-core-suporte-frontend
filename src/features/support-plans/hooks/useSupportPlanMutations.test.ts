import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockToastSuccess, mockToastError, mockInvalidateQueries, mockCreate, mockUpdate } =
  vi.hoisted(() => ({
    mockToastSuccess: vi.fn(),
    mockToastError: vi.fn(),
    mockInvalidateQueries: vi.fn(),
    mockCreate: vi.fn(),
    mockUpdate: vi.fn(),
  }))

vi.mock('../../../components/ui/Toast', () => ({
  useToast: () => ({ success: mockToastSuccess, error: mockToastError, info: vi.fn() }),
}))

vi.mock('../services/supportPlansService', () => ({
  createSupportPlan: mockCreate,
  updateSupportPlan: mockUpdate,
}))

// `utils/planErrorMessage` NÃO é mockado de propósito: é ele que traduz o
// `422 PLAN_RENAME_UNSAFE`, e o teste abaixo existe para provar que a mutation passa
// por ele em vez de cair no `handleApiError` genérico.

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>()
  return { ...actual, useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }) }
})

import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios'
import { useSupportPlanMutations } from './useSupportPlanMutations'
import type { SupportPlanRequest } from '../types/supportPlan'

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

const payload: SupportPlanRequest = {
  nome: 'Support Pro',
  horasMes: 40,
  precoHoraExtra: null,
  moeda: 'BRL',
  hubspotValor: null,
  slaPrimeiroAtendimentoMinutos: null,
  slaIsento: false,
  calendarioId: null,
}

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return React.createElement(QueryClientProvider, { client }, children)
}

describe('useSupportPlanMutations', () => {
  beforeEach(() => vi.clearAllMocks())

  it('create: sucesso dispara toast e invalida planos, unmatched e as telas que leem horasMes', async () => {
    mockCreate.mockResolvedValueOnce({ id: 1 })
    const { result } = renderHook(() => useSupportPlanMutations(), { wrapper })

    await act(async () => {
      await result.current.create.mutateAsync(payload)
    })

    expect(mockCreate).toHaveBeenCalledWith(payload)
    expect(mockToastSuccess).toHaveBeenCalledWith('Plano criado.')

    const chaves = mockInvalidateQueries.mock.calls.map((c) => JSON.stringify(c[0]?.queryKey))
    expect(chaves).toContain(JSON.stringify(['support-plans']))
    expect(chaves).toContain(JSON.stringify(['support-plans', 'unmatched']))
    // As duas telas abaixo exibem horas contratadas vindas do cadastro
    // (`MetricsQueryRepository.cs:1257`, `ReportQueryRepository.cs:752`). Sem estas
    // invalidações o gestor edita o plano e continua vendo o número antigo.
    expect(chaves).toContain(JSON.stringify(['metrics-plan-health']))
    expect(chaves).toContain(JSON.stringify(['plan-consumption']))
  })

  it('update: envia id e payload separados e invalida as mesmas chaves', async () => {
    mockUpdate.mockResolvedValueOnce({ id: 7 })
    const { result } = renderHook(() => useSupportPlanMutations(), { wrapper })

    await act(async () => {
      await result.current.update.mutateAsync({ id: 7, payload })
    })

    expect(mockUpdate).toHaveBeenCalledWith(7, payload)
    expect(mockToastSuccess).toHaveBeenCalledWith('Plano atualizado.')
    expect(mockInvalidateQueries).toHaveBeenCalled()
  })

  it('update com 422 PLAN_RENAME_UNSAFE mostra a mensagem ACIONÁVEL — nunca o toast genérico', async () => {
    // Vermelho se o `onError` voltar a usar `handleApiError`: o texto perderia a ação e o
    // usuário ficaria sem saber o que fazer, com a fatura em risco (R-1).
    mockUpdate.mockRejectedValueOnce(
      erroApi(422, 'PLAN_RENAME_UNSAFE', 'O plano tem 14 clientes vinculados.'),
    )
    const { result } = renderHook(() => useSupportPlanMutations(), { wrapper })

    await act(async () => {
      await result.current.update.mutateAsync({ id: 7, payload }).catch(() => undefined)
    })

    await waitFor(() => expect(mockToastError).toHaveBeenCalled())
    const texto = mockToastError.mock.calls[0]?.[0] as string
    expect(texto).toContain('14 clientes vinculados')
    expect(texto).toContain('Preencha o identificador do HubSpot')
    expect(mockToastSuccess).not.toHaveBeenCalled()
    // Falha não invalida cache: o servidor recusou, nada mudou lá.
    expect(mockInvalidateQueries).not.toHaveBeenCalled()
  })

  it('mutateAsync REJEITA no erro — é o que mantém o modal aberto com o erro inline', async () => {
    mockUpdate.mockRejectedValueOnce(erroApi(422, 'PLAN_RENAME_UNSAFE', 'x'))
    const { result } = renderHook(() => useSupportPlanMutations(), { wrapper })

    await expect(
      act(async () => {
        await result.current.update.mutateAsync({ id: 7, payload })
      }),
    ).rejects.toBeInstanceOf(AxiosError)
  })
})
