import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockToastSuccess,
  mockToastError,
  mockInvalidateQueries,
  mockCreate,
  mockUpdate,
  mockToggle,
  mockDelete,
} = vi.hoisted(() => ({
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
  mockInvalidateQueries: vi.fn(),
  mockCreate: vi.fn(),
  mockUpdate: vi.fn(),
  mockToggle: vi.fn(),
  mockDelete: vi.fn(),
}))

vi.mock('../../../components/ui/Toast', () => ({
  useToast: () => ({ success: mockToastSuccess, error: mockToastError, info: vi.fn() }),
}))

vi.mock('../../../utils/handleApiError', () => ({
  handleApiError: (err: unknown) => (err instanceof Error ? err.message : 'erro'),
}))

vi.mock('../services/serviceCategoriesService', () => ({
  createServiceCategory: mockCreate,
  updateServiceCategory: mockUpdate,
  toggleServiceCategory: mockToggle,
  deleteServiceCategory: mockDelete,
}))

// `utils/categoryErrorMessage` NÃO é mockado de propósito: é ele que traduz o 409, e o
// teste de conflito abaixo existe para provar que a mutation passa por ele.

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>()
  return { ...actual, useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }) }
})

import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios'
import { useCategoryMutations } from './useCategoryMutations'

/** Erro 409 com o envelope real do backend (`ExceptionHandlingMiddleware` → camelCase). */
function conflito(message: string): AxiosError {
  const config = { headers: new AxiosHeaders() }
  const response: AxiosResponse = {
    data: { error: { code: 'CONFLICT', message } },
    status: 409,
    statusText: '',
    headers: {},
    config,
  }
  return new AxiosError('Request failed with status code 409', undefined, config, {}, response)
}

/** Chaves passadas a `invalidateQueries`, na ordem em que foram invalidadas. */
function chavesInvalidadas(): unknown[] {
  return mockInvalidateQueries.mock.calls.map((call) => (call[0] as { queryKey: unknown }).queryKey)
}

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children)
}

describe('useCategoryMutations', () => {
  beforeEach(() => vi.clearAllMocks())

  it('create: sucesso → toast e invalida lista', async () => {
    mockCreate.mockResolvedValueOnce({ id: 1, nome: 'X', isActive: true })
    const { result } = renderHook(() => useCategoryMutations(), { wrapper: createWrapper() })

    act(() => result.current.create.mutate({ nome: 'X', forcesBillableOutsidePlan: false }))
    await waitFor(() => expect(result.current.create.isSuccess).toBe(true))

    expect(mockToastSuccess).toHaveBeenCalledWith('Categoria adicionada.')
    // A invalidação é asseverada por IDENTIDADE no bloco "invalidação de cache" abaixo,
    // para as 4 mutations. `toHaveBeenCalled()` aqui passava até com o defeito antigo
    // (uma única chave errada), então ficou de fora de propósito (123/QA r4, `A-3`).
  })

  it('toggleActive: ativar → toast "Categoria ativada."', async () => {
    mockToggle.mockResolvedValueOnce({ id: 1, nome: 'X', isActive: true })
    const { result } = renderHook(() => useCategoryMutations(), { wrapper: createWrapper() })

    act(() => result.current.toggleActive.mutate({ id: 1, isActive: true }))
    await waitFor(() => expect(result.current.toggleActive.isSuccess).toBe(true))

    expect(mockToggle).toHaveBeenCalledWith(1, true)
    expect(mockToastSuccess).toHaveBeenCalledWith('Categoria ativada.')
  })

  it('toggleActive: desativar → toast "Categoria desativada."', async () => {
    mockToggle.mockResolvedValueOnce({ id: 'c-1', nome: 'X', isActive: false })
    const { result } = renderHook(() => useCategoryMutations(), { wrapper: createWrapper() })

    act(() => result.current.toggleActive.mutate({ id: 1, isActive: false }))
    await waitFor(() => expect(result.current.toggleActive.isSuccess).toBe(true))

    expect(mockToastSuccess).toHaveBeenCalledWith('Categoria desativada.')
  })

  it('remove: erro → toast.error', async () => {
    mockDelete.mockRejectedValueOnce(new Error('Categoria em uso'))
    const { result } = renderHook(() => useCategoryMutations(), { wrapper: createWrapper() })

    act(() => result.current.remove.mutate(1))
    await waitFor(() => expect(result.current.remove.isError).toBe(true))

    expect(mockToastError).toHaveBeenCalledWith('Categoria em uso')
  })

  describe('update (renomear — 123/FE-2)', () => {
    it('sucesso: chama o PUT com (id, nome), toast e invalida a lista', async () => {
      mockUpdate.mockResolvedValueOnce({ id: 7, nome: 'Consultoria N2', isActive: true })
      const { result } = renderHook(() => useCategoryMutations(), { wrapper: createWrapper() })

      act(() =>
        result.current.update.mutate({
          id: 7,
          nome: 'Consultoria N2',
          forcesBillableOutsidePlan: true,
        }),
      )
      await waitFor(() => expect(result.current.update.isSuccess).toBe(true))

      // Vermelho se a mutation inverter os argumentos, mandar o objeto cru ao service, ou
      // (133) parar de repassar a flag — o service tem 3 parâmetros posicionais e um
      // 3º argumento perdido vira `undefined` no body, que o servidor lê como
      // "não alterar".
      expect(mockUpdate).toHaveBeenCalledWith(7, 'Consultoria N2', true)
      // 133: o PUT não é mais só "renomear"; o toast não pode afirmar o que o request não
      // faz mais sozinho (`AP-FRONTEND-022`).
      expect(mockToastSuccess).toHaveBeenCalledWith('Categoria atualizada.')
    })

    it('409: toast explica o conflito e diz o que fazer', async () => {
      mockUpdate.mockRejectedValueOnce(conflito("Já existe uma categoria com o nome 'Plantão'."))
      const { result } = renderHook(() => useCategoryMutations(), { wrapper: createWrapper() })

      act(() =>
        result.current.update.mutate({ id: 7, nome: 'Plantão', forcesBillableOutsidePlan: false }),
      )
      await waitFor(() => expect(result.current.update.isError).toBe(true))

      // Vermelho se o onError voltar a usar o `handleApiError` cru: o mock deste arquivo o
      // faz devolver `err.message`, ou seja "Request failed with status code 409".
      expect(mockToastError).toHaveBeenCalledWith(
        "Já existe uma categoria com o nome 'Plantão'. Escolha um nome diferente.",
      )
    })

    it('409 com mensagem NOVA (categoria desativada — BE-2) chega ao usuário sem retrabalho', async () => {
      const doBe2 = "Existe uma categoria desativada com o nome 'Plantão'."
      mockUpdate.mockRejectedValueOnce(conflito(doBe2))
      const { result } = renderHook(() => useCategoryMutations(), { wrapper: createWrapper() })

      act(() =>
        result.current.update.mutate({ id: 7, nome: 'Plantão', forcesBillableOutsidePlan: false }),
      )
      await waitFor(() => expect(result.current.update.isError).toBe(true))

      expect(mockToastError).toHaveBeenCalledWith(`${doBe2} Escolha um nome diferente.`)
    })

    it('erro sem envelope (rede) cai na mensagem genérica, não na de conflito', async () => {
      mockUpdate.mockRejectedValueOnce(new Error('Network Error'))
      const { result } = renderHook(() => useCategoryMutations(), { wrapper: createWrapper() })

      act(() =>
        result.current.update.mutate({ id: 7, nome: 'X', forcesBillableOutsidePlan: false }),
      )
      await waitFor(() => expect(result.current.update.isError).toBe(true))

      expect(mockToastError).not.toHaveBeenCalledWith(expect.stringContaining('Escolha um nome'))
    })
  })

  /**
   * 133 — a flag atravessa o hook até o service, **nos dois valores**. O par
   * `true`/`false` é o que discrimina: com só um dos casos, uma implementação que
   * mandasse `true` fixo (ou que perdesse o argumento) passaria.
   */
  describe('flag de cobrança obrigatória fora do plano (133)', () => {
    it('update repassa a flag LIGADA como 3º argumento posicional do service', async () => {
      mockUpdate.mockResolvedValueOnce({
        id: 7,
        nome: 'Consultoria N2',
        isActive: true,
        forcesBillableOutsidePlan: true,
      })
      const { result } = renderHook(() => useCategoryMutations(), { wrapper: createWrapper() })

      act(() =>
        result.current.update.mutate({
          id: 7,
          nome: 'Consultoria N2',
          forcesBillableOutsidePlan: true,
        }),
      )
      await waitFor(() => expect(result.current.update.isSuccess).toBe(true))

      expect(mockUpdate).toHaveBeenCalledWith(7, 'Consultoria N2', true)
    })

    it('update repassa a flag DESLIGADA — `false` é valor, não ausência', async () => {
      // Vermelho se o hook montar o objeto com spread condicional ou "otimizar" o `false`
      // para fora: o service receberia `undefined` e o body sairia sem a chave.
      mockUpdate.mockResolvedValueOnce({
        id: 7,
        nome: 'Consultoria',
        isActive: true,
        forcesBillableOutsidePlan: false,
      })
      const { result } = renderHook(() => useCategoryMutations(), { wrapper: createWrapper() })

      act(() =>
        result.current.update.mutate({
          id: 7,
          nome: 'Consultoria',
          forcesBillableOutsidePlan: false,
        }),
      )
      await waitFor(() => expect(result.current.update.isSuccess).toBe(true))

      expect(mockUpdate).toHaveBeenCalledWith(7, 'Consultoria', false)
    })

    it('create repassa a flag nos dois valores (2º argumento posicional)', async () => {
      mockCreate.mockResolvedValue({ id: 1, nome: 'X', isActive: true })
      const { result } = renderHook(() => useCategoryMutations(), { wrapper: createWrapper() })

      act(() =>
        result.current.create.mutate({ nome: 'Consultoria', forcesBillableOutsidePlan: true }),
      )
      await waitFor(() => expect(mockCreate).toHaveBeenCalledWith('Consultoria', true))

      act(() => result.current.create.mutate({ nome: 'Suporte', forcesBillableOutsidePlan: false }))
      await waitFor(() => expect(mockCreate).toHaveBeenCalledWith('Suporte', false))
    })
  })

  /**
   * Invalidação de cache — as 4 mutations no MESMO nível de asserção (123/QA r4, `A-3`).
   *
   * Antes, só `update` asseverava a identidade das chaves; `create` usava
   * `toHaveBeenCalled()` (que passa com QUALQUER chave única, inclusive com o defeito
   * antigo de prefixo) e `toggleActive`/`remove` não tinham asserção nenhuma.
   */
  describe('invalidação de cache', () => {
    type Mutations = ReturnType<typeof useCategoryMutations>

    /** Cada mutation do hook, no caminho de SUCESSO. */
    const CASOS: ReadonlyArray<{
      nome: string
      prepara: () => void
      dispara: (m: Mutations) => void
    }> = [
      {
        nome: 'create',
        prepara: () => void mockCreate.mockResolvedValueOnce({ id: 1, nome: 'X', isActive: true }),
        dispara: (m) => m.create.mutate({ nome: 'X', forcesBillableOutsidePlan: false }),
      },
      {
        nome: 'update',
        prepara: () => void mockUpdate.mockResolvedValueOnce({ id: 7, nome: 'Novo', isActive: true }),
        dispara: (m) => m.update.mutate({ id: 7, nome: 'Novo', forcesBillableOutsidePlan: false }),
      },
      {
        nome: 'toggleActive',
        prepara: () => void mockToggle.mockResolvedValueOnce({ id: 1, nome: 'X', isActive: false }),
        dispara: (m) => m.toggleActive.mutate({ id: 1, isActive: false }),
      },
      {
        nome: 'remove',
        prepara: () => void mockDelete.mockResolvedValueOnce(undefined),
        dispara: (m) => m.remove.mutate(1),
      },
    ]

    it('a lista de casos cobre TODAS as mutations que o hook expõe', () => {
      const { result } = renderHook(() => useCategoryMutations(), { wrapper: createWrapper() })

      // Enumeração DERIVADA em runtime do próprio hook (`rules/security.md` § invariante):
      // mutation nova nasce dentro da cobertura ou este teste fica vermelho nomeando-a.
      // Comparar conjuntos, não cardinalidade — cardinalidade passa se uma entra e outra sai.
      expect(CASOS.map((caso) => caso.nome).sort()).toEqual(Object.keys(result.current).sort())
    })

    it.each(CASOS)(
      '$nome: sucesso invalida as 3 chaves dependentes — por identidade, não por presença',
      async ({ prepara, dispara }) => {
        prepara()
        const { result } = renderHook(() => useCategoryMutations(), { wrapper: createWrapper() })

        act(() => dispara(result.current))
        // Condição observável do caminho de sucesso (todo `onSuccess` emite toast) — e
        // independente da invalidação, que é o que está sob teste.
        await waitFor(() => expect(mockToastSuccess).toHaveBeenCalled())

        // IDENTIDADE das chaves. `['service-categories']` é PREFIXO — casa a chave desta
        // tela e a do filtro de Apontamentos; `['category-options-active']` é a do combo do
        // modal de apontamento, que nenhum prefixo alcança. O `toHaveLength(3)` fecha a
        // outra ponta: chave a mais também reprova (invalidação cega custa refetch).
        const chaves = chavesInvalidadas()
        expect(chaves).toContainEqual(['service-categories', { includeInactive: true }])
        expect(chaves).toContainEqual(['service-categories'])
        expect(chaves).toContainEqual(['category-options-active'])
        expect(chaves).toHaveLength(3)
      },
    )
  })

  it('create com nome duplicado (409) também recebe a mensagem acionável', async () => {
    mockCreate.mockRejectedValueOnce(conflito("Já existe uma categoria com o nome 'X'."))
    const { result } = renderHook(() => useCategoryMutations(), { wrapper: createWrapper() })

    act(() => result.current.create.mutate({ nome: 'X', forcesBillableOutsidePlan: false }))
    await waitFor(() => expect(result.current.create.isError).toBe(true))

    expect(mockToastError).toHaveBeenCalledWith(
      "Já existe uma categoria com o nome 'X'. Escolha um nome diferente.",
    )
  })
})
