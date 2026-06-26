/**
 * Testes de useTicketDrill (016).
 * Verifica: query desabilitada sem drill ativo; ativação ao passar DrillSpec;
 * params do metric/filtros enviados ao serviço; reset de página/ordenação ao trocar
 * de drill; paginação.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { useTicketDrill } from './useTicketDrill'
import * as metricsService from '../services/metricsService'
import type { PaginatedResponse } from '../../../../types/api'
import type { DrillSpec, MetricsBaseParams, TicketRowDto } from '../types/metrics'

const MOCK_ROW: TicketRowDto = {
  ticketId: 1,
  hubspotTicketId: '101',
  assunto: 'Problema de acesso',
  clienteNome: 'ACME',
  equipe: 'Suporte',
  ownerNome: 'Fulano',
  status: 'Em andamento',
  hsCriadoEm: '2026-06-10',
  fechadoEm: null,
  reabertoEm: '2026-06-15',
  frHoras: null,
  frHorasUteis: null,
  frSla: null,
  resHoras: null,
  resHorasUteis: null,
  csat: null,
  isOneTouch: null,
  hubspotUrl: null,
}

const MOCK_PAGE: PaginatedResponse<TicketRowDto> = {
  items: [MOCK_ROW],
  totalCount: 1,
  page: 1,
  pageSize: 25,
  totalPages: 1,
}

const BASE: MetricsBaseParams = {
  scope: 'management:suporte',
  from: '2026-06-01',
  to: '2026-06-26',
  clientId: '42',
}

const REABERTOS: DrillSpec = { metric: 'tickets-reabertos', title: 'Tickets reabertos' }
const SLA_ON: DrillSpec = {
  metric: 'tickets-sla',
  title: 'No prazo',
  params: { sla: 'on' },
}

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client }, children)
}

describe('useTicketDrill', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('sem drill ativo (null) — queryFn não é chamado', () => {
    const spy = vi.spyOn(metricsService, 'getMetricRows').mockResolvedValue(MOCK_PAGE)

    renderHook(() => useTicketDrill(null, BASE), { wrapper: makeWrapper() })

    expect(spy).not.toHaveBeenCalled()
  })

  it('com drill ativo — chama getMetricRows com metric + filtros da tela', async () => {
    const spy = vi.spyOn(metricsService, 'getMetricRows').mockResolvedValue(MOCK_PAGE)

    const { result } = renderHook(() => useTicketDrill(REABERTOS, BASE), {
      wrapper: makeWrapper(),
    })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        metric: 'tickets-reabertos',
        scope: 'management:suporte',
        from: '2026-06-01',
        to: '2026-06-26',
        clientId: '42',
        page: 1,
        pageSize: 25,
      }),
    )
    expect(result.current.data?.items).toHaveLength(1)
    expect(result.current.isActive).toBe(true)
  })

  it('repassa o param sla do DrillSpec', async () => {
    const spy = vi.spyOn(metricsService, 'getMetricRows').mockResolvedValue(MOCK_PAGE)

    const { result } = renderHook(() => useTicketDrill(SLA_ON, BASE), {
      wrapper: makeWrapper(),
    })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ sla: 'on' }))
  })

  it('setPage(2) → page muda e queryFn é chamado com page:2', async () => {
    const spy = vi
      .spyOn(metricsService, 'getMetricRows')
      .mockResolvedValue({ ...MOCK_PAGE, page: 2 })

    const { result } = renderHook(() => useTicketDrill(REABERTOS, BASE), {
      wrapper: makeWrapper(),
    })

    act(() => {
      result.current.setPage(2)
    })

    await waitFor(() =>
      expect(spy).toHaveBeenCalledWith(expect.objectContaining({ page: 2 })),
    )
    expect(result.current.page).toBe(2)
  })

  it('trocar de drill reseta página e ordenação', async () => {
    vi.spyOn(metricsService, 'getMetricRows').mockResolvedValue(MOCK_PAGE)

    const { result, rerender } = renderHook(
      ({ drill }: { drill: DrillSpec }) => useTicketDrill(drill, BASE),
      { wrapper: makeWrapper(), initialProps: { drill: REABERTOS } },
    )

    // setSort define a ordenação e reseta a página (comportamento esperado);
    // depois movemos para a página 3 para validar o reset ao trocar de drill.
    act(() => {
      result.current.setSort('hscriadoem')
    })
    act(() => {
      result.current.setPage(3)
    })

    await waitFor(() => expect(result.current.page).toBe(3))
    expect(result.current.sortBy).toBe('hscriadoem')

    rerender({ drill: SLA_ON })

    await waitFor(() => expect(result.current.page).toBe(1))
    expect(result.current.sortBy).toBeNull()
    expect(result.current.sortDirection).toBe('desc')
  })

  it('setSort com mesmo campo inverte a direção', async () => {
    vi.spyOn(metricsService, 'getMetricRows').mockResolvedValue(MOCK_PAGE)

    const { result } = renderHook(() => useTicketDrill(REABERTOS, BASE), {
      wrapper: makeWrapper(),
    })

    act(() => result.current.setSort('hscriadoem'))
    expect(result.current.sortDirection).toBe('desc')

    act(() => result.current.setSort('hscriadoem'))
    expect(result.current.sortDirection).toBe('asc')
  })
})
