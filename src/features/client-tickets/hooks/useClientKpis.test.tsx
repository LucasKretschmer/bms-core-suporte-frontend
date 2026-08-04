/**
 * useClientKpis — 121/C1: o período entra na chamada ao serviço E na queryKey.
 * Sem o período na queryKey o TanStack Query serviria o resultado do período anterior
 * e o bug voltaria em forma de cache — é isso que o 2º teste discrimina, comparando os
 * NÚMEROS (quantidades diferentes em cada período), não a chamada.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { ReactNode } from 'react'
import { useClientKpis } from './useClientKpis'
import {
  getClientKpis,
  type ClientKpisPeriod,
} from '../services/clientTicketsService'
import type { PlanConsumptionItemDto } from '../../reports/shared/types/reports'

vi.mock('../services/clientTicketsService', () => ({
  getClientKpis: vi.fn(),
}))

const mockedKpis = vi.mocked(getClientKpis)

function kpiRow(horasUsadas: number, percentualPlano: number): PlanConsumptionItemDto {
  return {
    clientId: 1,
    cnpj: null,
    nomeFantasia: 'Acme',
    razaoSocial: null,
    nomePlano: 'Plano X',
    qtdePlanoHoras: 10,
    horasUsadas,
    horasRestantes: 10 - horasUsadas,
    horasAdicionais: 0,
    percentualPlano,
    horasFaturaveis: 0,
    horasAnalise: 0,
  }
}

/** Junho: 4h / 40%. Julho: 9h / 90%. Quantidades diferentes de propósito. */
const POR_PERIODO: Record<string, PlanConsumptionItemDto> = {
  '2026-06-01|2026-06-30': kpiRow(4, 40),
  '2026-07-01|2026-07-31': kpiRow(9, 90),
}

function wrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
}

beforeEach(() => {
  mockedKpis.mockReset()
  mockedKpis.mockImplementation((_clientId: number, period: ClientKpisPeriod) =>
    Promise.resolve(POR_PERIODO[`${period.from ?? ''}|${period.to ?? ''}`] ?? null),
  )
})

describe('useClientKpis', () => {
  it('passa clientId e período ao serviço', async () => {
    renderHook(() => useClientKpis(1, { from: '2026-06-01', to: '2026-06-30' }), {
      wrapper: wrapper(),
    })
    await waitFor(() => {
      expect(mockedKpis).toHaveBeenCalledWith(1, { from: '2026-06-01', to: '2026-06-30' })
    })
  })

  it('trocar o período troca os NÚMEROS (a queryKey inclui from/to — sem cache do período anterior)', async () => {
    const { result, rerender } = renderHook(
      ({ period }: { period: ClientKpisPeriod }) => useClientKpis(1, period),
      {
        wrapper: wrapper(),
        initialProps: { period: { from: '2026-06-01', to: '2026-06-30' } },
      },
    )

    await waitFor(() => expect(result.current.data?.horasUsadas).toBe(4))
    expect(result.current.data?.percentualPlano).toBe(40)

    rerender({ period: { from: '2026-07-01', to: '2026-07-31' } })

    await waitFor(() => expect(result.current.data?.horasUsadas).toBe(9))
    expect(result.current.data?.percentualPlano).toBe(90)
  })

  it('período nulo é repassado como null (ramo explícito — backend aplica o default)', async () => {
    const { result } = renderHook(() => useClientKpis(1, { from: null, to: null }), {
      wrapper: wrapper(),
    })
    await waitFor(() => {
      expect(mockedKpis).toHaveBeenCalledWith(1, { from: null, to: null })
    })
    // Período sem linha no fake → null (cliente sem consumo na janela).
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.data).toBeNull()
  })

  it('não consulta sem clientId', () => {
    renderHook(() => useClientKpis(0, { from: null, to: null }), { wrapper: wrapper() })
    expect(mockedKpis).not.toHaveBeenCalled()
  })
})
