import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { RegistroDto } from '../types/sincronizador'

// ── Mocks ──────────────────────────────────────────────────────────────────────

const mockHandleBusca = vi.fn()
const mockReset = vi.fn()
const mockRefetch = vi.fn()
const mockMutate = vi.fn()

// Estado simulado da query de busca
let mockQueryState: {
  data: RegistroDto[] | undefined
  isFetching: boolean
  isError: boolean
  refetch: typeof mockRefetch
} = {
  data: undefined,
  isFetching: false,
  isError: false,
  refetch: mockRefetch,
}

vi.mock('../hooks/useRegistrosBusca', () => ({
  useRegistrosBusca: () => ({
    query: mockQueryState,
    termo: '',
    handleBusca: mockHandleBusca,
    reset: mockReset,
  }),
}))

vi.mock('../hooks/useDeleteRegistro', () => ({
  useDeleteRegistro: () => ({
    mutate: mockMutate,
    isPending: false,
  }),
}))

vi.mock('../../../components/ui/Toast', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  }),
}))

/**
 * 134 · U9 — o export é **espionado**, não reescrito: `reports/shared/utils/exportTable` é
 * território de outra unidade desta demanda (U0) e este arquivo não o edita. O mock existe
 * só para ler as colunas que a tela entrega ao utilitário.
 * `vi.hoisted` é obrigatório: a factory do `vi.mock` roda antes do corpo do módulo, e uma
 * referência direta a `const` daqui cairia em TDZ.
 */
const { mockExportToCsv, mockExportToXlsx } = vi.hoisted(() => ({
  mockExportToCsv: vi.fn(),
  mockExportToXlsx: vi.fn(),
}))
vi.mock('../../reports/shared/utils/exportTable', () => ({
  exportToCsv: mockExportToCsv,
  exportToXlsx: mockExportToXlsx,
}))

import { chavesDeDuracao } from '../../../test/duracaoExport'
import type { ExportColumn } from '../../reports/shared/utils/exportTable'
import { ManutencaoRegistros } from './ManutencaoRegistros'

function makeRegistro(overrides?: Partial<RegistroDto>): RegistroDto {
  return {
    tipo: 'ticket',
    hubspotId: '123456',
    assunto: 'Problema com login',
    pipeline: 'Suporte',
    criadoEm: '2026-01-15T10:00:00Z',
    ...overrides,
  }
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  })
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children)
}

describe('ManutencaoRegistros', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockQueryState = {
      data: undefined,
      isFetching: false,
      isError: false,
      refetch: mockRefetch,
    }
  })

  it('exibe erro de validação inline quando campo de busca tem 1 char e submit é tentado', async () => {
    render(<ManutencaoRegistros />, { wrapper: createWrapper() })

    const input = screen.getByPlaceholderText('ID HubSpot ou trecho do assunto')
    fireEvent.change(input, { target: { value: 'a' } })
    fireEvent.click(screen.getByText('Buscar'))

    await waitFor(() => {
      expect(screen.getByText('Informe ao menos 2 caracteres para buscar.')).toBeInTheDocument()
    })
  })

  it('mostra EmptyState quando resultado é lista vazia', () => {
    mockQueryState = { ...mockQueryState, data: [] }
    render(<ManutencaoRegistros />, { wrapper: createWrapper() })
    expect(screen.getByText('Nenhum registro encontrado para esta busca.')).toBeInTheDocument()
  })

  it('mostra ErrorState quando query retorna erro', () => {
    mockQueryState = { ...mockQueryState, data: undefined, isError: true }
    render(<ManutencaoRegistros />, { wrapper: createWrapper() })
    expect(screen.getByText('Não foi possível carregar os registros.')).toBeInTheDocument()
  })

  it('ErrorState → onRetry chama query.refetch (não nova busca vazia)', () => {
    mockQueryState = { ...mockQueryState, data: undefined, isError: true }
    render(<ManutencaoRegistros />, { wrapper: createWrapper() })

    fireEvent.click(screen.getByText('Tentar novamente'))

    expect(mockRefetch).toHaveBeenCalledTimes(1)
    expect(mockHandleBusca).not.toHaveBeenCalled()
  })

  it('botão Desativar visível para registro retornado', () => {
    mockQueryState = { ...mockQueryState, data: [makeRegistro()] }

    render(<ManutencaoRegistros />, { wrapper: createWrapper() })

    expect(screen.getByRole('button', { name: /Desativar ticket #123456/i })).toBeInTheDocument()
  })

  it('abre ConfirmDialog ao clicar em Desativar', async () => {
    mockQueryState = { ...mockQueryState, data: [makeRegistro()] }

    render(<ManutencaoRegistros />, { wrapper: createWrapper() })

    fireEvent.click(screen.getByRole('button', { name: /Desativar ticket #123456/i }))

    await waitFor(() => {
      expect(screen.getByText('Desativar registro')).toBeInTheDocument()
    })
  })

  it('ConfirmDialog exibe informações do registro selecionado', async () => {
    mockQueryState = { ...mockQueryState, data: [makeRegistro()] }

    render(<ManutencaoRegistros />, { wrapper: createWrapper() })

    fireEvent.click(screen.getByRole('button', { name: /Desativar ticket #123456/i }))

    await waitFor(() => {
      expect(screen.getByText('Desativar registro')).toBeInTheDocument()
      const desc = screen.getByRole('alertdialog')
      expect(desc).toHaveTextContent('Problema com login')
      expect(desc).toHaveTextContent('123456')
    })
  })

  it('chama handleBusca com valor do input ao submeter', async () => {
    render(<ManutencaoRegistros />, { wrapper: createWrapper() })

    const input = screen.getByPlaceholderText('ID HubSpot ou trecho do assunto')
    fireEvent.change(input, { target: { value: 'busca teste' } })
    fireEvent.click(screen.getByText('Buscar'))

    await waitFor(() => {
      expect(mockHandleBusca).toHaveBeenCalledWith('busca teste')
    })
  })
})

/**
 * 134 · U9 — veredito "SEM duração" (análise §1.2).
 *
 * Manutenção de registros exporta Tipo · ID HubSpot · Assunto · Pipeline · Criado em.
 * `Criado em` é **instante** (`formatDate`), não duração — PRD §2.4 separa os dois. Logo
 * esta superfície fica FORA da conversão para `[h]:mm:ss`, e o veredito é travado aqui.
 *
 * 🔴 `toEqual([])` é asserção negativa, satisfeita pelo vazio (`rules/tests.md` § padrão 1):
 * passaria se o clique não exportasse nada, se as colunas viessem `[]` ou se o detector
 * estivesse morto. Por isso as duas positivas na MESMA execução (P1 e P2 abaixo).
 */
describe('ManutencaoRegistros — veredito "sem duração" no export (134)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockQueryState = {
      data: [makeRegistro(), makeRegistro({ tipo: 'projeto', hubspotId: '999', pipeline: null })],
      isFetching: false,
      isError: false,
      refetch: mockRefetch,
    }
  })

  it('nenhuma das colunas do CSV/XLSX é de duração', async () => {
    render(<ManutencaoRegistros />, { wrapper: createWrapper() })

    fireEvent.click(screen.getByRole('button', { name: 'Baixar CSV' }))
    fireEvent.click(screen.getByRole('button', { name: 'Baixar Excel' }))
    await waitFor(() => expect(mockExportToXlsx).toHaveBeenCalledTimes(1))

    const colunasCsv = mockExportToCsv.mock.calls[0][1] as ExportColumn[]
    const colunasXlsx = mockExportToXlsx.mock.calls[0][1] as ExportColumn[]
    const ESPERADAS = ['tipo', 'hubspotId', 'assunto', 'pipeline', 'criadoEm']

    // P1 · positiva com literal à mão: a superfície REAL chegou ao utilitário de export.
    // Vermelho se uma coluna nascer, sumir ou mudar de chave — inclusive uma de tempo.
    expect(colunasCsv.map((c) => c.key)).toEqual(ESPERADAS)
    expect(colunasXlsx.map((c) => c.key)).toEqual(ESPERADAS)

    // P2 · o detector DISCRIMINA: marcadas, estas mesmas colunas voltam não-vazias.
    expect(chavesDeDuracao(colunasCsv.map((c) => ({ ...c, type: 'duration' as const })))).toEqual(
      ESPERADAS,
    )

    // VEREDITO · vermelho se alguém marcar qualquer coluna daqui como duração sem passar
    // pelo inventário da demanda (R8 da análise: a decisão passa a ser explícita).
    expect(chavesDeDuracao(colunasCsv)).toEqual([])
    expect(chavesDeDuracao(colunasXlsx)).toEqual([])
  })

  it('`Criado em` sai como DATA, não como duração — é o porquê do veredito', () => {
    render(<ManutencaoRegistros />, { wrapper: createWrapper() })

    fireEvent.click(screen.getByRole('button', { name: 'Baixar CSV' }))

    const [, , linhas] = mockExportToCsv.mock.calls[0]
    // Literal à mão: 2026-01-15 formatado dd/MM/yyyy. Vermelho se alguém trocar o mapper
    // por um total de tempo (e aí a coluna passaria a precisar de `type: 'duration'`).
    expect(linhas[0].criadoEm).toBe('15/01/2026')
    expect(linhas[0].tipo).toBe('Ticket')
    expect(linhas[1].pipeline).toBe('—')
  })
})
