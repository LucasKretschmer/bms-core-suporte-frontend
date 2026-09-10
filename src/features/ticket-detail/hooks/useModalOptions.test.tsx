/**
 * 133/FE-2 · T-FE2-1 — o hook devolve o índice `categoriasQueForcam`.
 *
 * Este é **o** teste do defeito silencioso nº 2 (`analise-frontend.md` §5.2): o `map` para
 * `ComboboxOption = { value, label }` é uma projeção, e campo que não entra nela some sem
 * erro, sem log e sem teste vermelho.
 *
 * Fixture com **cardinalidade assimétrica** (1 com flag × 3 sem) de propósito: com 1×1 o
 * predicado invertido passaria. E a asserção é de **identidade do conjunto**
 * (`toEqual(new Set([...]))`), não `.has(...)` — `.has` não vê o conjunto crescer demais.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'

vi.mock('../services/modalOptionsService', () => ({
  listAgentOptions: vi.fn(),
  listActiveCategoryOptions: vi.fn(),
}))

import { useModalOptions } from './useModalOptions'
import {
  listActiveCategoryOptions,
  listAgentOptions,
  type ServiceCategoryOptionDto,
} from '../services/modalOptionsService'

const mockedCategories = vi.mocked(listActiveCategoryOptions)
const mockedAgents = vi.mocked(listAgentOptions)

/**
 * O DTO declara `forcesBillableOutsidePlan?: boolean`, mas o **wire** pode trazer `null`
 * (outro serializador do lado de lá). O cast existe só para escrever esse caso no teste —
 * é exatamente o cenário que `AP-FRONTEND-028` manda cobrir com `null` EXPLÍCITO, porque
 * um teste só com a chave ausente passaria também numa implementação `!== false`.
 */
const categorias = [
  { id: 2, nome: 'Consultoria', isActive: true, forcesBillableOutsidePlan: true },
  { id: 3, nome: 'Suporte', isActive: true, forcesBillableOutsidePlan: false },
  { id: 4, nome: 'Treinamento', isActive: true, forcesBillableOutsidePlan: null },
  { id: 5, nome: 'Legado', isActive: true },
] as unknown as ServiceCategoryOptionDto[]

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

describe('useModalOptions (133)', () => {
  beforeEach(() => {
    mockedCategories.mockReset()
    mockedAgents.mockReset()
    mockedAgents.mockResolvedValue([])
  })

  it('indexa só as categorias que forçam — e não regride o combo', async () => {
    mockedCategories.mockResolvedValue(categorias)

    const { result } = renderHook(() => useModalOptions(true), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    // Identidade do conjunto: Set vazio (a flag morreu no map) e Set inchado
    // (predicado invertido → {'3','4','5'}) reprovam os dois.
    expect(result.current.categoriasQueForcam).toEqual(new Set(['2']))

    // Companheira positiva, na MESMA execução: o combo continua completo e na ordem.
    expect(result.current.categoryOptions).toEqual([
      { value: '2', label: 'Consultoria' },
      { value: '3', label: 'Suporte' },
      { value: '4', label: 'Treinamento' },
      { value: '5', label: 'Legado' },
    ])
  })

  it('lista sem nenhuma flag ligada produz conjunto vazio com o combo cheio', async () => {
    // Discriminador do caso acima: prova que o Set vazio significa "nenhuma força",
    // e não "o hook nunca chegou a montar o índice".
    mockedCategories.mockResolvedValue([
      { id: 3, nome: 'Suporte', isActive: true, forcesBillableOutsidePlan: false },
      { id: 5, nome: 'Legado', isActive: true },
    ])

    const { result } = renderHook(() => useModalOptions(true), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.categoriasQueForcam).toEqual(new Set())
    expect(result.current.categoryOptions).toHaveLength(2)
  })
})
