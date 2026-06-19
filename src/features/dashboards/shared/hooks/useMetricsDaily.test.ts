/**
 * Testes de useMetricsDaily.
 * Verifica tratamento de array vazio, dias com zeros e mapeamento correto.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { useMetricsDaily } from './useMetricsDaily'
import * as metricsService from '../services/metricsService'
import type { MetricsDailyDto } from '../types/metrics'

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client }, children)
}

describe('useMetricsDaily', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('array days vazio → data.days é array vazio, sem crash', async () => {
    const empty: MetricsDailyDto = { days: [] }
    vi.spyOn(metricsService, 'getMetricsDaily').mockResolvedValue(empty)

    const { result } = renderHook(
      () =>
        useMetricsDaily({
          scope: 'management:suporte',
          from: '2026-06-01',
          to: '2026-06-17',
        }),
      { wrapper: makeWrapper() },
    )

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.data?.days).toEqual([])
  })

  it('dias com valores zero → mapeados corretamente', async () => {
    const withZeros: MetricsDailyDto = {
      days: [
        {
          data: '2026-06-01',
          novos: 0,
          emAndamento: 0,
          resolvidos: 0,
          cancelados: 0,
          emAberto: 0,
        },
      ],
    }
    vi.spyOn(metricsService, 'getMetricsDaily').mockResolvedValue(withZeros)

    const { result } = renderHook(
      () =>
        useMetricsDaily({
          scope: 'management:suporte',
          from: '2026-06-01',
          to: '2026-06-01',
        }),
      { wrapper: makeWrapper() },
    )

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.data?.days[0]).toMatchObject({
      data: '2026-06-01',
      novos: 0,
      emAndamento: 0,
      resolvidos: 0,
    })
  })

  it('retorna dados corretamente com múltiplos dias', async () => {
    const mock: MetricsDailyDto = {
      days: [
        {
          data: '2026-06-01',
          novos: 5,
          emAndamento: 10,
          resolvidos: 3,
          cancelados: 1,
          emAberto: 20,
        },
        {
          data: '2026-06-02',
          novos: 7,
          emAndamento: 8,
          resolvidos: 6,
          cancelados: 0,
          emAberto: 22,
        },
      ],
    }
    vi.spyOn(metricsService, 'getMetricsDaily').mockResolvedValue(mock)

    const { result } = renderHook(
      () =>
        useMetricsDaily({
          scope: 'management:suporte',
          from: '2026-06-01',
          to: '2026-06-02',
        }),
      { wrapper: makeWrapper() },
    )

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.data?.days).toHaveLength(2)
    expect(result.current.data?.days[1].novos).toBe(7)
  })

  it('retorna isError=true quando service falha', async () => {
    vi.spyOn(metricsService, 'getMetricsDaily').mockRejectedValue(
      new Error('Falha de rede'),
    )

    const { result } = renderHook(
      () =>
        useMetricsDaily({
          scope: 'management:suporte',
          from: '2026-06-01',
          to: '2026-06-17',
        }),
      { wrapper: makeWrapper() },
    )

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.isError).toBe(true)
  })
})
