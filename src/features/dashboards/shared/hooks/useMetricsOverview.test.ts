/**
 * Testes de useMetricsOverview.
 * Verifica queryKey, estados loading/error e tipagem do retorno.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { useMetricsOverview } from './useMetricsOverview'
import * as metricsService from '../services/metricsService'
import type { MetricsOverviewDto } from '../types/metrics'

const MOCK_OVERVIEW: MetricsOverviewDto = {
  tempoTotalSegundos: 36000,
  ahtSegundos: 1800,
  tempoMedioPausaSegundos: null,
  mediaPausasPorAtendimento: null,
  backlog: 12,
  ticketsAbertos: 30,
  ticketsAbertosVariacaoPercent: 5.5,
  ticketsResolvidos: 20,
  ticketsResolvidosVariacaoPercent: -2.0,
  taxaResolucao: 66.7,
  tmrHorasCorridas: null,
  tmrHorasUteis: null,
  tmeHorasCorridas: null,
  tmeHorasUteis: null,
  respondidosNoPrazo: null,
  respondidosForaDoPrazo: null,
  ticketsReabertos: null,
  csat: null,
  fcr: null,
  horasPlantao: 7200,
  horasPlano: 14400,
  horasFaturadoPorFora: 3600,
  horasAnalise: 1800,
}

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client }, children)
}

describe('useMetricsOverview', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('retorna isLoading=true na inicialização', () => {
    vi.spyOn(metricsService, 'getMetricsOverview').mockReturnValue(
      new Promise(() => {}), // nunca resolve
    )
    const { result } = renderHook(
      () =>
        useMetricsOverview({
          scope: 'management:suporte',
          from: '2026-06-01',
          to: '2026-06-17',
        }),
      { wrapper: makeWrapper() },
    )
    expect(result.current.isLoading).toBe(true)
  })

  it('retorna data corretamente após query resolver', async () => {
    vi.spyOn(metricsService, 'getMetricsOverview').mockResolvedValue(MOCK_OVERVIEW)
    const { result } = renderHook(
      () =>
        useMetricsOverview({
          scope: 'management:suporte',
          from: '2026-06-01',
          to: '2026-06-17',
        }),
      { wrapper: makeWrapper() },
    )

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.data).toMatchObject({
      backlog: 12,
      ticketsAbertos: 30,
      ahtSegundos: 1800,
    })
  })

  it('retorna isError=true quando service lança erro', async () => {
    vi.spyOn(metricsService, 'getMetricsOverview').mockRejectedValue(
      new Error('Erro de rede'),
    )
    const { result } = renderHook(
      () =>
        useMetricsOverview({
          scope: 'management:suporte',
          from: '2026-06-01',
          to: '2026-06-17',
        }),
      { wrapper: makeWrapper() },
    )

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.isError).toBe(true)
  })

  it('queryKey inclui scope, from, to', async () => {
    const spy = vi
      .spyOn(metricsService, 'getMetricsOverview')
      .mockResolvedValue(MOCK_OVERVIEW)

    const { result } = renderHook(
      () =>
        useMetricsOverview({
          scope: 'team:abc',
          from: '2026-06-01',
          to: '2026-06-17',
        }),
      { wrapper: makeWrapper() },
    )

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    // Verifica que o service foi chamado com os parâmetros corretos
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: 'team:abc',
        from: '2026-06-01',
        to: '2026-06-17',
      }),
    )
  })

  it('campo ahtSegundos null é tolerado — retorna null sem crash', async () => {
    vi.spyOn(metricsService, 'getMetricsOverview').mockResolvedValue({
      ...MOCK_OVERVIEW,
      ahtSegundos: null,
    })
    const { result } = renderHook(
      () =>
        useMetricsOverview({
          scope: 'management:suporte',
          from: null,
          to: null,
        }),
      { wrapper: makeWrapper() },
    )

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.data?.ahtSegundos).toBeNull()
  })

  it('refetch está disponível', async () => {
    vi.spyOn(metricsService, 'getMetricsOverview').mockResolvedValue(MOCK_OVERVIEW)
    const { result } = renderHook(
      () =>
        useMetricsOverview({
          scope: 'management:suporte',
          from: null,
          to: null,
        }),
      { wrapper: makeWrapper() },
    )

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(typeof result.current.refetch).toBe('function')
  })
})
