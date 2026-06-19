import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { RegistroDto } from '../types/sincronizador'

// ── Mocks ──────────────────────────────────────────────────────────────────────

const mockHandleBusca = vi.fn()
const mockReset = vi.fn()
const mockMutate = vi.fn()

// Estado simulado da query de busca
let mockQueryState: {
  data: RegistroDto[] | undefined
  isFetching: boolean
  isError: boolean
} = {
  data: undefined,
  isFetching: false,
  isError: false,
}

vi.mock('../hooks/useRegistrosBusca', () => ({
  useRegistrosBusca: () => ({
    query: mockQueryState,
    busca: '',
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
    hubspotId: '123456',
    tipo: 'ticket',
    assunto: 'Problema com login',
    status: 'aberto',
    clienteNome: 'Empresa XPTO',
    criadoem: '2026-01-15T10:00:00Z',
    desativadoem: null,
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
    mockQueryState = { data: undefined, isFetching: false, isError: false }
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
    mockQueryState = { data: [], isFetching: false, isError: false }
    render(<ManutencaoRegistros />, { wrapper: createWrapper() })
    expect(screen.getByText('Nenhum registro encontrado para esta busca.')).toBeInTheDocument()
  })

  it('mostra ErrorState quando query retorna erro', () => {
    mockQueryState = { data: undefined, isFetching: false, isError: true }
    render(<ManutencaoRegistros />, { wrapper: createWrapper() })
    expect(screen.getByText('Não foi possível carregar os registros.')).toBeInTheDocument()
  })

  it('botão Desativar visível para registro ativo (desativadoem=null)', () => {
    const registro = makeRegistro({ desativadoem: null })
    mockQueryState = { data: [registro], isFetching: false, isError: false }

    render(<ManutencaoRegistros />, { wrapper: createWrapper() })

    expect(screen.getByRole('button', { name: /Desativar ticket #123456/i })).toBeInTheDocument()
  })

  it('botão Desativar oculto para registro já desativado', () => {
    const registro = makeRegistro({ desativadoem: '2026-01-20T10:00:00Z' })
    mockQueryState = { data: [registro], isFetching: false, isError: false }

    render(<ManutencaoRegistros />, { wrapper: createWrapper() })

    expect(screen.queryByRole('button', { name: /Desativar ticket #123456/i })).not.toBeInTheDocument()
  })

  it('abre ConfirmDialog ao clicar em Desativar', async () => {
    const registro = makeRegistro({ desativadoem: null })
    mockQueryState = { data: [registro], isFetching: false, isError: false }

    render(<ManutencaoRegistros />, { wrapper: createWrapper() })

    fireEvent.click(screen.getByRole('button', { name: /Desativar ticket #123456/i }))

    await waitFor(() => {
      expect(screen.getByText('Desativar registro')).toBeInTheDocument()
    })
  })

  it('ConfirmDialog exibe informações do registro selecionado', async () => {
    const registro = makeRegistro({ desativadoem: null })
    mockQueryState = { data: [registro], isFetching: false, isError: false }

    render(<ManutencaoRegistros />, { wrapper: createWrapper() })

    fireEvent.click(screen.getByRole('button', { name: /Desativar ticket #123456/i }))

    await waitFor(() => {
      // Verificar que o dialog abriu com o título correto
      expect(screen.getByText('Desativar registro')).toBeInTheDocument()
      // Verificar que a descrição contém o assunto do registro
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
