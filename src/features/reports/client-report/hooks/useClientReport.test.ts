/**
 * Testes de U5 — Hook useClientReport.
 *
 * Cobertura obrigatória:
 *   - Default ao abrir (068): from = 1º dia do mês atual (startOfMonth),
 *     to = último dia do mês atual (endOfMonth) — YYYY-MM-DD.
 *   - enabled=false quando clientId, from ou to são null.
 *   - Ativa query quando os filtros obrigatórios estão preenchidos.
 *   - Envia from/to ao getClientReport (não mais month).
 *   - Visão combinada/origem (057) preservada.
 *   - Privacidade: nenhum vazamento de categoria do HubSpot.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import React from 'react'
import { useClientReport } from './useClientReport'
import type { ClientReportDto } from '../../shared/types/reports'

/** Intervalo default do mês atual (068): 1º dia → último dia. */
const today = new Date()
const defaultFrom = format(startOfMonth(today), 'yyyy-MM-dd')
const defaultTo = format(endOfMonth(today), 'yyyy-MM-dd')

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
      timeEntryId: 1,
      origem: 'ticket',
      ticketId: 1,
      hubspotTicketId: '1001',
      projetoId: null,
      projetoNome: null,
      stage: null,
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

  it('default ao abrir (068): from = 1º dia e to = último dia do mês atual (YYYY-MM-DD)', () => {
    const { result } = renderHook(() => useClientReport(), {
      wrapper: createWrapper(),
    })
    expect(result.current.filters.from).toBe(defaultFrom)
    expect(result.current.filters.to).toBe(defaultTo)
  })

  it('inicia com hasRequiredFilters=false quando não há cliente (intervalo sozinho não basta)', () => {
    const { result } = renderHook(() => useClientReport(), {
      wrapper: createWrapper(),
    })
    // intervalo default preenchido, mas clientId null → ainda falta filtro obrigatório.
    expect(result.current.hasRequiredFilters).toBe(false)
  })

  it('inicia com clientId=null e intervalo = mês atual (clearable)', () => {
    const { result } = renderHook(() => useClientReport(), {
      wrapper: createWrapper(),
    })
    expect(result.current.filters.clientId).toBeNull()
    expect(result.current.filters.from).toBe(defaultFrom)
    expect(result.current.filters.to).toBe(defaultTo)
  })

  it('intervalo é clearable (usuário pode limpar from/to para null)', () => {
    const { result } = renderHook(() => useClientReport(), {
      wrapper: createWrapper(),
    })
    act(() => result.current.setFilters({ from: null, to: null }))
    expect(result.current.filters.from).toBeNull()
    expect(result.current.filters.to).toBeNull()
  })

  it('não chama getClientReport quando clientId é null', () => {
    renderHook(() => useClientReport(), {
      wrapper: createWrapper(),
    })
    expect(mockGetClientReport).not.toHaveBeenCalled()
  })

  it('não chama getClientReport quando from é null', () => {
    const { result } = renderHook(() => useClientReport(), {
      wrapper: createWrapper(),
    })
    act(() => result.current.setFilters({ clientId: 'client-1', from: null }))
    expect(mockGetClientReport).not.toHaveBeenCalled()
  })

  it('não chama getClientReport quando to é null', () => {
    const { result } = renderHook(() => useClientReport(), {
      wrapper: createWrapper(),
    })
    act(() => result.current.setFilters({ clientId: 'client-1', to: null }))
    expect(mockGetClientReport).not.toHaveBeenCalled()
  })

  it('hasRequiredFilters=true quando cliente + intervalo preenchidos', async () => {
    mockGetClientReport.mockResolvedValue(MOCK_REPORT)

    const { result } = renderHook(() => useClientReport(), {
      wrapper: createWrapper(),
    })

    act(() =>
      result.current.setFilters({
        clientId: 'client-1',
        from: '2024-03-01',
        to: '2024-03-31',
      }),
    )

    await waitFor(() => {
      expect(result.current.hasRequiredFilters).toBe(true)
    })
  })

  it('envia from/to (não month) ao getClientReport quando filtros preenchidos', async () => {
    mockGetClientReport.mockResolvedValue(MOCK_REPORT)

    const { result } = renderHook(() => useClientReport(), {
      wrapper: createWrapper(),
    })

    act(() =>
      result.current.setFilters({
        clientId: 'client-1',
        from: '2024-03-01',
        to: '2024-03-31',
      }),
    )

    await waitFor(() => {
      expect(mockGetClientReport).toHaveBeenCalledWith(
        expect.objectContaining({
          clientId: 'client-1',
          from: '2024-03-01',
          to: '2024-03-31',
        }),
      )
    })
    // Garante que o param legado `month` não é mais enviado.
    const callArg = mockGetClientReport.mock.calls[0][0]
    expect(callArg).not.toHaveProperty('month')
  })

  it('retorna reportData após query bem-sucedida', async () => {
    mockGetClientReport.mockResolvedValue(MOCK_REPORT)

    const { result } = renderHook(() => useClientReport(), {
      wrapper: createWrapper(),
    })

    act(() =>
      result.current.setFilters({
        clientId: 'client-1',
        from: '2024-03-01',
        to: '2024-03-31',
      }),
    )

    await waitFor(() => {
      expect(result.current.reportData).toEqual(MOCK_REPORT)
    })
  })

  it('paginatedData tem totalCount correto baseado em totalApontamentos', async () => {
    mockGetClientReport.mockResolvedValue(MOCK_REPORT)

    const { result } = renderHook(() => useClientReport(), {
      wrapper: createWrapper(),
    })

    act(() =>
      result.current.setFilters({
        clientId: 'client-1',
        from: '2024-03-01',
        to: '2024-03-31',
      }),
    )

    await waitFor(() => {
      expect(result.current.paginatedData?.totalCount).toBe(
        MOCK_REPORT.totalApontamentos,
      )
    })
  })

  it('resetFilters restaura filtros iniciais (intervalo = mês atual)', () => {
    const { result } = renderHook(() => useClientReport(), {
      wrapper: createWrapper(),
    })

    act(() =>
      result.current.setFilters({
        clientId: 'client-1',
        from: '2024-03-01',
        to: '2024-03-31',
      }),
    )
    act(() => result.current.resetFilters())

    expect(result.current.filters.clientId).toBeNull()
    expect(result.current.filters.from).toBe(defaultFrom)
    expect(result.current.filters.to).toBe(defaultTo)
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
      result.current.setFilters({
        clientId: 'client-1',
        from: '2024-03-01',
        to: '2024-03-31',
      })
    })

    await waitFor(() => expect(result.current.hasRequiredFilters).toBe(true))

    act(() => {
      result.current.setPage(3)
    })
    expect(result.current.page).toBe(3)

    act(() => {
      result.current.setFilters({ from: '2024-04-01', to: '2024-04-30' })
    })
    expect(result.current.page).toBe(1)
  })
})

// ── Testes da visão combinada (057 — filtro de origem) ───────────────────────

describe('useClientReport — origem (057)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('inicia com origem = "all" (todos: ticket + projeto)', () => {
    const { result } = renderHook(() => useClientReport(), {
      wrapper: createWrapper(),
    })
    expect(result.current.filters.origem).toBe('all')
  })

  it('propaga origem ao getClientReport quando filtros preenchidos', async () => {
    mockGetClientReport.mockResolvedValue(MOCK_REPORT)

    const { result } = renderHook(() => useClientReport(), {
      wrapper: createWrapper(),
    })

    act(() => {
      result.current.setFilters({
        clientId: 'client-1',
        from: '2024-03-01',
        to: '2024-03-31',
        origem: 'projeto',
      })
    })

    await waitFor(() => {
      expect(mockGetClientReport).toHaveBeenCalledWith(
        expect.objectContaining({
          clientId: 'client-1',
          from: '2024-03-01',
          to: '2024-03-31',
          origem: 'projeto',
        }),
      )
    })
  })

  it('ao mudar origem, reseta para página 1', async () => {
    mockGetClientReport.mockResolvedValue({ ...MOCK_REPORT, totalApontamentos: 100 })

    const { result } = renderHook(() => useClientReport(), {
      wrapper: createWrapper(),
    })

    act(() => {
      result.current.setFilters({
        clientId: 'client-1',
        from: '2024-03-01',
        to: '2024-03-31',
      })
    })
    await waitFor(() => expect(result.current.hasRequiredFilters).toBe(true))

    act(() => result.current.setPage(2))
    expect(result.current.page).toBe(2)

    act(() => result.current.setFilters({ origem: 'ticket' }))
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

    act(() =>
      result.current.setFilters({
        clientId: 'client-1',
        from: '2024-03-01',
        to: '2024-03-31',
      }),
    )

    await waitFor(() => {
      expect(result.current.reportData).toBeDefined()
    })

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
          timeEntryId: 1,
          origem: 'ticket',
          ticketId: 1,
          hubspotTicketId: '1001',
          projetoId: null,
          projetoNome: null,
          stage: null,
          assunto: 'Ticket normal',
          equipeAtribuida: 'N1',
          solicitante: null,
          atendente: 'Ana',
          categorizacaoAtendimento: 'Consultoria',
          faturamento: 'Não faturado',
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

    act(() =>
      result.current.setFilters({
        clientId: 'client-1',
        from: '2024-03-01',
        to: '2024-03-31',
      }),
    )

    await waitFor(() => {
      expect(result.current.reportData?.items).toBeDefined()
    })

    const items = result.current.reportData?.items ?? []
    items.forEach((item) => {
      expect(item.faturamento).not.toContain('Invoicy')
      if (item.categorizacaoAtendimento) {
        expect(item.categorizacaoAtendimento).not.toBe('Problema - Invoicy')
      }
    })
  })
})
