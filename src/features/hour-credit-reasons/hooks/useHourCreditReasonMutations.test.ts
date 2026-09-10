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
vi.mock('../services/hourCreditReasonsService', () => ({
  createHourCreditReason: mockCreate,
  updateHourCreditReason: mockUpdate,
  deleteHourCreditReason: mockDelete,
}))
// `utils/hourCreditReasonErrorMessage` NÃO é mockado: é ele que ramifica os três 409.
vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>()
  return { ...actual, useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }) }
})

import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios'
import { useHourCreditReasonMutations } from './useHourCreditReasonMutations'

function conflito(code: string, message: string): AxiosError {
  const config = { headers: new AxiosHeaders() }
  const response: AxiosResponse = {
    data: { error: { code, message } },
    status: 409,
    statusText: '',
    headers: {},
    config,
  }
  return new AxiosError('Request failed with status code 409', undefined, config, {}, response)
}

/** O `QueryClientProvider` é obrigatório: o `useMutation` resolve o cliente pelo seu próprio import. */
function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children)
}

function chavesInvalidadas(): unknown[] {
  return mockInvalidateQueries.mock.calls.map((c) => (c[0] as { queryKey: unknown }).queryKey)
}

describe('useHourCreditReasonMutations', () => {
  beforeEach(() => vi.clearAllMocks())

  it('🔴 criar invalida `hour-credit-reasons` E `hour-credits` — identidade das chaves', async () => {
    // A tabela de créditos exibe `motivoNome`: sem a segunda chave, renomear um motivo
    // deixaria a outra tela mostrando o nome antigo até um reload.
    mockCreate.mockResolvedValue({ id: 2 })
    const { result } = renderHook(() => useHourCreditReasonMutations(), { wrapper: createWrapper() })

    result.current.create.mutate('Cortesia comercial')

    await waitFor(() => expect(mockToastSuccess).toHaveBeenCalledWith('Motivo adicionado.'))
    expect(chavesInvalidadas()).toEqual([['hour-credit-reasons'], ['hour-credits']])
  })

  it('renomear delega ao service com id + nome', async () => {
    mockUpdate.mockResolvedValue({ id: 2 })
    const { result } = renderHook(() => useHourCreditReasonMutations(), { wrapper: createWrapper() })

    result.current.update.mutate({ id: 2, nome: 'Cortesia' })

    await waitFor(() => expect(mockUpdate).toHaveBeenCalledWith(2, 'Cortesia'))
    expect(mockToastSuccess).toHaveBeenCalledWith('Motivo atualizado.')
  })

  it('🔴 409 MOTIVO_EM_USO no DELETE chega ao toast COM a ação acionável', async () => {
    // Vermelho se o `onError` do `remove` voltar a usar `handleApiError` direto — o
    // usuário leria só "em uso" e ficaria tentando de novo.
    mockDelete.mockRejectedValue(conflito('MOTIVO_EM_USO', 'O motivo 2 tem créditos ativos.'))
    const { result } = renderHook(() => useHourCreditReasonMutations(), { wrapper: createWrapper() })

    result.current.remove.mutate(2)

    await waitFor(() => expect(mockToastError).toHaveBeenCalled())
    const texto = mockToastError.mock.calls[0][0] as string
    expect(texto).toContain('O motivo 2 tem créditos ativos.')
    expect(texto).toContain('antes de excluí-lo')
    expect(mockInvalidateQueries).not.toHaveBeenCalled()
  })

  it('409 MOTIVO_DE_SISTEMA no DELETE explica a proteção (rede além da UI)', async () => {
    // A coluna já bloqueia a ação, mas o bloqueio depende de `isSistema` vir no wire;
    // contra um backend que ainda não manda a flag, esta é a única explicação que sobra.
    mockDelete.mockRejectedValue(conflito('MOTIVO_DE_SISTEMA', 'Recusado.'))
    const { result } = renderHook(() => useHourCreditReasonMutations(), { wrapper: createWrapper() })

    result.current.remove.mutate(1)

    await waitFor(() => expect(mockToastError).toHaveBeenCalled())
    expect(mockToastError.mock.calls[0][0]).toContain('processo automático de crédito')
  })
})
