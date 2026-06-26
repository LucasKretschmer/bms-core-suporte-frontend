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
