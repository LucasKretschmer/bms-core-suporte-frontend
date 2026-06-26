/**
 * Testes da SupportMovimentacaoSection (#1).
 * Verifica que os estados (loading / erro / empty / com dados) propagam
 * corretamente para o ChartCard, incluindo o empty honesto de "dias todos-zero".
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SupportMovimentacaoSection } from './SupportMovimentacaoSection'
import type { MetricsDailyDto, DailyDataPointDto } from '../../shared/types/metrics'

// Mock do hook de dados — controlamos o retorno por teste.
const useMetricsDailyMock = vi.fn()
vi.mock('../../shared/hooks/useMetricsDaily', () => ({
  useMetricsDaily: (...args: unknown[]) => useMetricsDailyMock(...args),
}))

// Mock de tokens para evitar dependência de CSS vars no jsdom.
vi.mock('../../shared/utils/chartTokens', () => ({
  getChartTokens: () => ({
    'chart-novos': '#2563EB',
    'chart-andamento': '#D97706',
    'chart-resolvidos': '#16A34A',
    'chart-cancelados': '#6B7280',
    'chart-aberto': '#DC2626',
  }),
  getChartPalette: () => ['#2563EB', '#16A34A'],
  resetChartTokensCache: () => {},
}))

type HookReturn = {
  data: MetricsDailyDto | undefined
  isLoading: boolean
  isError: boolean
  refetch: () => void
}

function setHook(partial: Partial<HookReturn>) {
  useMetricsDailyMock.mockReturnValue({
    data: undefined,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
    ...partial,
  })
}

function ponto(overrides: Partial<DailyDataPointDto> = {}): DailyDataPointDto {
  return {
    data: '2026-06-01',
    novos: 0,
    emAndamento: 0,
    resolvidos: 0,
    cancelados: 0,
    emAberto: 0,
    ...overrides,
  }
}

const props = { scope: 'global' as const, from: null, to: null }

describe('SupportMovimentacaoSection', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
    useMetricsDailyMock.mockReset()
  })

  it('sem dias → empty honesto', () => {
    setHook({ data: { days: [] } })
    render(<SupportMovimentacaoSection {...props} />)
    expect(screen.getByText(/sem movimentação registrada/i)).toBeInTheDocument()
  })

  it('dias com tudo zero → empty honesto (não parece quebrado)', () => {
    setHook({ data: { days: [ponto({ data: '2026-06-01' }), ponto({ data: '2026-06-02' })] } })
    render(<SupportMovimentacaoSection {...props} />)
    expect(screen.getByText(/sem movimentação registrada/i)).toBeInTheDocument()
  })

  it('dias com movimentação real → renderiza o gráfico (não empty)', () => {
    setHook({ data: { days: [ponto({ data: '2026-06-01', novos: 4, resolvidos: 2 })] } })
    render(<SupportMovimentacaoSection {...props} />)
    expect(screen.queryByText(/sem movimentação registrada/i)).not.toBeInTheDocument()
  })

  it('isError → ErrorState (via ChartCard), não empty', () => {
    setHook({ isError: true })
    render(<SupportMovimentacaoSection {...props} />)
    expect(screen.queryByText(/sem movimentação registrada/i)).not.toBeInTheDocument()
  })

  it('isLoading → skeleton, não empty nem gráfico', () => {
    setHook({ isLoading: true })
    render(<SupportMovimentacaoSection {...props} />)
    const skeleton = document.querySelector('[aria-busy="true"]')
    expect(skeleton).toBeTruthy()
    expect(screen.queryByText(/sem movimentação registrada/i)).not.toBeInTheDocument()
  })
})
