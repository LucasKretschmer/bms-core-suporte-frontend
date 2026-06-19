/**
 * Testes de U5 — Hook useClientReport.
 *
 * Cobertura obrigatória conforme analise-frontend.md:
 *   - enabled=false quando clientId ou month são null.
 *   - Ativa query quando ambos os filtros estão preenchidos.
 *   - hasRequiredFilters reflete corretamente o estado dos filtros.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { useClientReport } from './useClientReport'
import type { ClientReportDto } from '../../shared/types/reports'

// ── Mock do serviço ───────────────────────────────────────────────────────────

vi.mock('../../shared/services/reportsService', () => ({
  getClientReport: vi.fn(),
}))

import { getClientReport } from '../../shared/services/reportsService'
const mockGetClientReport = vi.mocked(getClientReport)

// ── Fixture ───────────────────────────────────────────────────────────────────

const MOCK_REPORT: ClientReportDto = {
  client: {
    id: 'client-1',
    hubspotCompanyId: 100,
    cnpj: '12.345.678/0001-90',
    razaoSocial: 'Empresa Ltda',
    nomeFantasia: 'Empresa',
    supportPlan: null,
    horasOverride: null,
    horasEfetivas: null,
  },
  plano: null,
  competencia: '2024-03',
  totalApontamentos: 5,
  totalSegundos: 18000,
  horasPlanoSegundos: 14400,
  horasFaturadoSegundos: 3600,
  horasNaoFaturadoSegundos: 0,
  items: [
    {
      timeEntryId: 'entry-1',
      ticketId: 'ticket-1',
      hubspotTicketId: '1001',
      assunto: 'Ticket de teste',
      equipeAtribuida: 'N1',
      solicitante: { nome: 'João', email: 'joao@empresa.com' },
      atendente: 'Ana',
      categorizacaoAtendimento: 'Consultoria',
      faturamento: 'Plano de Suporte',
      aberturaDosChamado: '2024-03-01T10:00:00Z',
      dataApontamento: '2024-03-15T14:00:00Z',
      totalSegundos: 3600,
    },
  ],
}

// ── Wrapper com QueryClient ───────────────────────────────────────────────────

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,
      },
    },
  })
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children)
  }
}

// ── Testes ────────────────────────────────────────────────────────────────────

describe('useClientReport', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('inicia com hasRequiredFilters=false quando clientId e month são null', () => {
    const { result } = renderHook(() => useClientReport(), {
      wrapper: createWrapper(),
    })
    expect(result.current.hasRequiredFilters).toBe(false)
  })

  it('inicia com filters padrão: clientId=null, month=null', () => {
    const { result } = renderHook(() => useClientReport(), {
      wrapper: createWrapper(),
    })
    expect(result.current.filters.clientId).toBeNull()
    expect(result.current.filters.month).toBeNull()
  })

  it('não chama getClientReport quando clientId é null', () => {
    renderHook(() => useClientReport(), {
      wrapper: createWrapper(),
    })
    expect(mockGetClientReport).not.toHaveBeenCalled()
  })

  it('não chama getClientReport quando month é null', () => {
    const { result } = renderHook(() => useClientReport(), {
      wrapper: createWrapper(),
    })
    // Define clientId mas não month
    result.current.setFilters({ clientId: 'client-1' })
    expect(mockGetClientReport).not.toHaveBeenCalled()
  })

  it('hasRequiredFilters=true quando ambos os filtros estão preenchidos', async () => {
    mockGetClientReport.mockResolvedValue(MOCK_REPORT)

    const { result } = renderHook(() => useClientReport(), {
      wrapper: createWrapper(),
    })

    result.current.setFilters({ clientId: 'client-1', month: '2024-03' })

    await waitFor(() => {
      expect(result.current.hasRequiredFilters).toBe(true)
    })
  })

  it('chama getClientReport com os parâmetros corretos quando filtros preenchidos', async () => {
    mockGetClientReport.mockResolvedValue(MOCK_REPORT)

    const { result } = renderHook(() => useClientReport(), {
      wrapper: createWrapper(),
    })

    result.current.setFilters({ clientId: 'client-1', month: '2024-03' })

    await waitFor(() => {
      expect(mockGetClientReport).toHaveBeenCalledWith(
        expect.objectContaining({
          clientId: 'client-1',
          month: '2024-03',
        }),
      )
    })
  })

  it('retorna reportData após query bem-sucedida', async () => {
    mockGetClientReport.mockResolvedValue(MOCK_REPORT)

    const { result } = renderHook(() => useClientReport(), {
      wrapper: createWrapper(),
    })

    result.current.setFilters({ clientId: 'client-1', month: '2024-03' })

    await waitFor(() => {
      expect(result.current.reportData).toEqual(MOCK_REPORT)
    })
  })

  it('paginatedData tem totalCount correto baseado em totalApontamentos', async () => {
    mockGetClientReport.mockResolvedValue(MOCK_REPORT)

    const { result } = renderHook(() => useClientReport(), {
      wrapper: createWrapper(),
    })

    result.current.setFilters({ clientId: 'client-1', month: '2024-03' })

    await waitFor(() => {
      expect(result.current.paginatedData?.totalCount).toBe(
        MOCK_REPORT.totalApontamentos,
      )
    })
  })

  it('resetFilters restaura filtros iniciais', async () => {
    const { result } = renderHook(() => useClientReport(), {
      wrapper: createWrapper(),
    })

    result.current.setFilters({ clientId: 'client-1', month: '2024-03' })
    result.current.resetFilters()

    expect(result.current.filters.clientId).toBeNull()
    expect(result.current.filters.month).toBeNull()
    expect(result.current.hasRequiredFilters).toBe(false)
  })

  it('setFilters reseta page para 1', async () => {
    mockGetClientReport.mockResolvedValue({
      ...MOCK_REPORT,
      totalApontamentos: 100,
    })

    const { result } = renderHook(() => useClientReport(), {
      wrapper: createWrapper(),
    })

    act(() => {
      result.current.setFilters({ clientId: 'client-1', month: '2024-03' })
    })

    await waitFor(() => expect(result.current.hasRequiredFilters).toBe(true))

    // Muda de página
    act(() => {
      result.current.setPage(3)
    })
    expect(result.current.page).toBe(3)

    // Mudar filtro deve resetar para página 1
    act(() => {
      result.current.setFilters({ month: '2024-04' })
    })
    expect(result.current.page).toBe(1)
  })
})

// ── Testes de privacidade do hook ────────────────────────────────────────────

describe('useClientReport — privacidade', () => {
  it('reportData retornado não deve conter campo "categoria" do HubSpot', async () => {
    mockGetClientReport.mockResolvedValue(MOCK_REPORT)

    const { result } = renderHook(() => useClientReport(), {
      wrapper: createWrapper(),
    })

    result.current.setFilters({ clientId: 'client-1', month: '2024-03' })

    await waitFor(() => {
      expect(result.current.reportData).toBeDefined()
    })

    // O ClientReportItemDto não deve ter campo "categoria"
    const items = result.current.reportData?.items ?? []
    items.forEach((item) => {
      expect(Object.keys(item)).not.toContain('categoria')
    })
  })

  it('os items não contêm texto "Invoicy" em nenhum campo de string', async () => {
    const reportWithData: ClientReportDto = {
      ...MOCK_REPORT,
      items: [
        {
          timeEntryId: 'entry-1',
          ticketId: 'ticket-1',
          hubspotTicketId: '1001',
          assunto: 'Ticket normal',
          equipeAtribuida: 'N1',
          solicitante: null,
          atendente: 'Ana',
          // PRIVACIDADE: categorizacaoAtendimento deve ser ServiceCategory interna
          // nunca "Problema - Invoicy"
          categorizacaoAtendimento: 'Consultoria',
          faturamento: 'Não faturado', // abstrai "Problema - Invoicy"
          aberturaDosChamado: '2024-03-01T10:00:00Z',
          dataApontamento: '2024-03-15T14:00:00Z',
          totalSegundos: 3600,
        },
      ],
    }

    mockGetClientReport.mockResolvedValue(reportWithData)

    const { result } = renderHook(() => useClientReport(), {
      wrapper: createWrapper(),
    })

    result.current.setFilters({ clientId: 'client-1', month: '2024-03' })

    await waitFor(() => {
      expect(result.current.reportData?.items).toBeDefined()
    })

    const items = result.current.reportData?.items ?? []
    items.forEach((item) => {
      // faturamento nunca deve conter "Invoicy"
      expect(item.faturamento).not.toContain('Invoicy')
      // categorizacaoAtendimento nunca deve ser "Problema - Invoicy"
      if (item.categorizacaoAtendimento) {
        expect(item.categorizacaoAtendimento).not.toBe('Problema - Invoicy')
      }
    })
  })
})
