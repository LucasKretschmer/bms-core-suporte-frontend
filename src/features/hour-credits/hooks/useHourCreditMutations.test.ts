import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockToastSuccess, mockToastError, mockInvalidateQueries, mockCreate, mockUpdate, mockDelete } =
  vi.hoisted(() => ({
    mockToastSuccess: vi.fn(),
    mockToastError: vi.fn(),
    mockInvalidateQueries: vi.fn(),
    mockCreate: vi.fn(),
    mockUpdate: vi.fn(),
    mockDelete: vi.fn(),
  }))

vi.mock('../../../components/ui/Toast', () => ({
  useToast: () => ({ success: mockToastSuccess, error: mockToastError, info: vi.fn() }),
}))
vi.mock('../services/hourCreditsService', () => ({
  createHourCredit: mockCreate,
  updateHourCredit: mockUpdate,
  deleteHourCredit: mockDelete,
}))
// `utils/hourCreditErrorMessage` NÃO é mockado: é ele que traduz o 409, e o teste de
// conflito abaixo existe para provar que a mutation passa por ele.
vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>()
  return { ...actual, useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }) }
})

import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios'
import { useHourCreditMutations } from './useHourCreditMutations'

function conflitoEstornado(): AxiosError {
  const config = { headers: new AxiosHeaders() }
  const response: AxiosResponse = {
    data: { error: { code: 'CREDITO_ESTORNADO', message: 'Crédito 10 já foi estornado.' } },
    status: 409,
    statusText: '',
    headers: {},
    config,
  }
  return new AxiosError('Request failed with status code 409', undefined, config, {}, response)
}

/**
 * O `QueryClientProvider` é obrigatório mesmo com `useQueryClient` mockado: o
 * `useMutation` resolve o cliente pelo SEU próprio import, que o spread do mock não
 * alcança. Mesmo arranjo de `useCategoryMutations.test.ts:69-71`.
 */
function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children)
}

/** As chaves invalidadas, na ordem em que a mutation as pede. */
function chavesInvalidadas(): unknown[] {
  return mockInvalidateQueries.mock.calls.map((c) => (c[0] as { queryKey: unknown }).queryKey)
}

describe('useHourCreditMutations', () => {
  beforeEach(() => vi.clearAllMocks())

  it('🔴 criar invalida `hour-credits` E `plan-consumption` — identidade das chaves', async () => {
    // A coluna "15h + 2h" do Consumo de Planos exibe o crédito do mês: sem a segunda
    // chave, lançar um crédito deixaria aquela tela mostrando o plano antigo até um
    // reload — erro silencioso, e numa tela que alimenta conversa de fatura.
    mockCreate.mockResolvedValue({ id: 1 })
    const { result } = renderHook(() => useHourCreditMutations(), { wrapper: createWrapper() })

    result.current.create.mutate({ clientId: 42, horas: 2, motivoId: 3 })

    await waitFor(() => expect(mockToastSuccess).toHaveBeenCalledWith('Crédito lançado.'))
    expect(chavesInvalidadas()).toEqual([['hour-credits'], ['plan-consumption']])
  })

  it('editar delega ao service com id + corpo e avisa o usuário', async () => {
    mockUpdate.mockResolvedValue({ id: 10 })
    const { result } = renderHook(() => useHourCreditMutations(), { wrapper: createWrapper() })

    result.current.update.mutate({ id: 10, horas: 5, motivoId: 4 })

    await waitFor(() => expect(mockUpdate).toHaveBeenCalledWith(10, { horas: 5, motivoId: 4 }))
    expect(mockToastSuccess).toHaveBeenCalledWith('Crédito atualizado.')
  })

  it('🔴 409 CREDITO_ESTORNADO chega ao toast COM a ação — não o texto genérico', async () => {
    // Vermelho se o `onError` voltar a usar `handleApiError` direto: o usuário leria só
    // "já foi estornado" e ficaria tentando salvar de novo.
    mockUpdate.mockRejectedValue(conflitoEstornado())
    const { result } = renderHook(() => useHourCreditMutations(), { wrapper: createWrapper() })

    result.current.update.mutate({ id: 10, horas: 5, motivoId: 4 })

    await waitFor(() => expect(mockToastError).toHaveBeenCalled())
    const texto = mockToastError.mock.calls[0][0] as string
    expect(texto).toContain('Crédito 10 já foi estornado.')
    expect(texto).toContain('lance um novo crédito')
    expect(mockInvalidateQueries).not.toHaveBeenCalled()
  })

  it('excluir invalida as mesmas duas chaves', async () => {
    mockDelete.mockResolvedValue(undefined)
    const { result } = renderHook(() => useHourCreditMutations(), { wrapper: createWrapper() })

    result.current.remove.mutate(10)

    await waitFor(() => expect(mockToastSuccess).toHaveBeenCalledWith('Crédito removido.'))
    expect(chavesInvalidadas()).toEqual([['hour-credits'], ['plan-consumption']])
  })
})
