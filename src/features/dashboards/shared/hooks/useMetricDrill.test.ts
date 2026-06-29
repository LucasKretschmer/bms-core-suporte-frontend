/**
 * Testes de useMetricDrill (016) — hook genérico de drill.
 * Verifica: query desabilitada sem drill; ativação por família; params específicos
 * (apontamento billing/serviceCategory/categoria/userId; cliente faixa; projeto tipo/stage)
 * enviados ao serviço; reset de página ao trocar de drill.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { useMetricDrill } from './useMetricDrill'
import * as metricsService from '../services/metricsService'
import type { PaginatedResponse } from '../../../../types/api'
import type {
  ClientRowDto,
  DrillSpec,
  MetricsBaseParams,
  ProjectRowDto,
  TimeEntryDrillRowDto,
} from '../types/metrics'

const BASE: MetricsBaseParams = {
  scope: 'management:suporte',
  from: '2026-06-01',
  to: '2026-06-26',
  clientId: '42',
}

function emptyPage<T>(): PaginatedResponse<T> {
  return { items: [], totalCount: 0, page: 1, pageSize: 25, totalPages: 0 }
}

function makeWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client }, children)
}

describe('useMetricDrill', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('sem drill ativo (null) — queryFn não é chamado', () => {
    const spy = vi.spyOn(metricsService, 'getMetricRows').mockResolvedValue(emptyPage())
    renderHook(() => useMetricDrill(null, BASE), { wrapper: makeWrapper() })
    expect(spy).not.toHaveBeenCalled()
  })

  it('família apontamento — repassa billing/serviceCategory', async () => {
    const spy = vi
      .spyOn(metricsService, 'getMetricRows')
      .mockResolvedValue(emptyPage<TimeEntryDrillRowDto>())

    const spec: DrillSpec = {
      metric: 'apontamentos',
      title: 'Plantão',
      params: { serviceCategory: 'Plantão' },
    }
    const { result } = renderHook(
      () => useMetricDrill<TimeEntryDrillRowDto>(spec, BASE),
      { wrapper: makeWrapper() },
    )

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        metric: 'apontamentos',
        serviceCategory: 'Plantão',
        scope: 'management:suporte',
        page: 1,
        pageSize: 25,
      }),
    )
  })

  it('família apontamento — repassa categoria e userId', async () => {
    const spy = vi
      .spyOn(metricsService, 'getMetricRows')
      .mockResolvedValue(emptyPage<TimeEntryDrillRowDto>())

    const spec: DrillSpec = {
      metric: 'apontamentos',
      title: 'Cat',
      params: { categoria: 'Dúvida', userId: '7' },
    }
    renderHook(() => useMetricDrill<TimeEntryDrillRowDto>(spec, BASE), {
      wrapper: makeWrapper(),
    })

    await waitFor(() =>
      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({ categoria: 'Dúvida', userId: '7' }),
      ),
    )
  })

  it('família cliente — repassa faixa', async () => {
    const spy = vi
      .spyOn(metricsService, 'getMetricRows')
      .mockResolvedValue(emptyPage<ClientRowDto>())

    const spec: DrillSpec = {
      metric: 'plan-health-clientes',
      title: 'Críticos',
      params: { faixa: 'vermelho' },
    }
    renderHook(() => useMetricDrill<ClientRowDto>(spec, { from: BASE.from, to: BASE.to }), {
      wrapper: makeWrapper(),
    })

    await waitFor(() =>
      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({ metric: 'plan-health-clientes', faixa: 'vermelho' }),
      ),
    )
  })

  it('família projeto — repassa tipo e stage', async () => {
    const spy = vi
      .spyOn(metricsService, 'getMetricRows')
      .mockResolvedValue(emptyPage<ProjectRowDto>())

    const spec: DrillSpec = {
      metric: 'projetos',
      title: 'Em execução',
      params: { tipo: 'onboarding', stage: 'execucao' },
    }
    renderHook(() => useMetricDrill<ProjectRowDto>(spec, { from: BASE.from, to: BASE.to }), {
      wrapper: makeWrapper(),
    })

    await waitFor(() =>
      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({ metric: 'projetos', tipo: 'onboarding', stage: 'execucao' }),
      ),
    )
  })

  it('trocar de drill reseta página', async () => {
    vi.spyOn(metricsService, 'getMetricRows').mockResolvedValue(emptyPage())

    const apont: DrillSpec = { metric: 'apontamentos', title: 'A' }
    const projeto: DrillSpec = { metric: 'projetos', title: 'P', params: { stage: 'parado' } }

    const { result, rerender } = renderHook(
      ({ drill }: { drill: DrillSpec }) => useMetricDrill(drill, BASE),
      { wrapper: makeWrapper(), initialProps: { drill: apont } },
    )

    act(() => result.current.setPage(3))
    await waitFor(() => expect(result.current.page).toBe(3))

    rerender({ drill: projeto })
    await waitFor(() => expect(result.current.page).toBe(1))
  })
})
