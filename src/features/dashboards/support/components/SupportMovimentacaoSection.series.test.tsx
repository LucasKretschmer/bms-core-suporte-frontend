/**
 * 123/D3b — o isolamento de série na SEÇÃO real (não só no componente de gráfico).
 *
 * Por que existe além do teste de componente: o empty honesto é decidido **acima** do
 * gráfico, em `SupportMovimentacaoSection` (`isMovimentacaoEmpty` olha o DADO). O risco
 * concreto do D3b é isolar uma série toda-zero e o card virar "Sem movimentação
 * registrada no período" — trocando um filtro de exibição por uma afirmação falsa sobre
 * o período. Só o teste de seção prova que isso não acontece.
 *
 * O que faz ficar vermelho: mover a decisão de empty para "o que está visível" (por
 * exemplo, calcular `isMovimentacaoEmpty` sobre a série isolada) derruba o 1º teste.
 * Remover a legenda interativa do gráfico derruba o 2º.
 */

import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SupportMovimentacaoSection } from './SupportMovimentacaoSection'
import type { MetricsDailyDto, DailyDataPointDto } from '../../shared/types/metrics'

// jsdom não tem layout: sem isto o ResponsiveContainer mede 0×0 e NENHUM <svg> é
// renderizado — as asserções sobre a linha passariam por vacuidade.
vi.mock('recharts', async () => {
  const actual = await vi.importActual<typeof import('recharts')>('recharts')
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactElement }) =>
      React.cloneElement(children, { width: 800, height: 300 } as Record<string, unknown>),
  }
})

const useMetricsDailyMock = vi.fn()
vi.mock('../../shared/hooks/useMetricsDaily', () => ({
  useMetricsDaily: (...args: unknown[]) => useMetricsDailyMock(...args),
}))

vi.mock('../../shared/utils/chartTokens', () => ({
  getChartTokens: () => ({
    'chart-novos': '#111111',
    'chart-andamento': '#222222',
    'chart-resolvidos': '#333333',
    'chart-cancelados': '#444444',
    'chart-aberto': '#555555',
  }),
  getChartPalette: () => ['#111111', '#222222'],
  resetChartTokensCache: () => {},
}))

function setHook(data: MetricsDailyDto) {
  useMetricsDailyMock.mockReturnValue({
    data,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  })
}

/**
 * Dias COM movimentação em `novos`/`resolvidos` e **zero** em `cancelados`.
 * Quantidades diferentes por série de propósito (fixture simétrica não discrimina).
 */
const DIAS: DailyDataPointDto[] = [
  { data: '2026-06-01', novos: 4, emAndamento: 2, resolvidos: 9, cancelados: 0, emAberto: 5 },
  { data: '2026-06-02', novos: 7, emAndamento: 3, resolvidos: 1, cancelados: 0, emAberto: 6 },
  { data: '2026-06-03', novos: 2, emAndamento: 8, resolvidos: 5, cancelados: 0, emAberto: 3 },
]

const props = { scope: 'global' as const, from: null, to: null }

function curvas(container: HTMLElement): SVGPathElement[] {
  return Array.from(container.querySelectorAll<SVGPathElement>('.recharts-line-curve'))
}

describe('SupportMovimentacaoSection — isolamento de série (123/D3b)', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
    useMetricsDailyMock.mockReset()
  })

  it('isolar uma série toda-zero NÃO aciona o empty state (o empty olha o dado, não o visível)', async () => {
    const user = userEvent.setup()
    setHook({ days: DIAS })
    const { container } = render(<SupportMovimentacaoSection {...props} />)

    // Positiva: antes de isolar, há 5 linhas e nenhum empty.
    expect(curvas(container)).toHaveLength(5)
    expect(screen.queryByText(/sem movimentação registrada/i)).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Cancelados' }))

    // A linha de Cancelados continua desenhada (achatada em zero), com a cor dela —
    // e o card NÃO virou "sem movimentação".
    const restantes = curvas(container)
    expect(restantes).toHaveLength(1)
    expect(restantes[0].getAttribute('stroke')).toBe('#444444')
    expect(screen.queryByText(/sem movimentação registrada/i)).toBeNull()
  })

  it('a legenda interativa chega até a seção real (Todas + as 5 séries)', () => {
    setHook({ days: DIAS })
    render(<SupportMovimentacaoSection {...props} />)

    const nomes = screen.getAllByRole('button').map((b) => b.textContent?.trim())
    expect(nomes).toEqual([
      'Todas',
      'Novos',
      'Em atendimento',
      'Resolvidos',
      'Cancelados',
      'Em aberto',
    ])
  })

  it('123/D3a na SEÇÃO: período de um único dia mostra marcador intencional + o porquê', () => {
    setHook({
      days: [
        { data: '2026-06-01', novos: 4, emAndamento: 2, resolvidos: 9, cancelados: 1, emAberto: 5 },
      ],
    })
    const { container } = render(<SupportMovimentacaoSection {...props} />)

    // Positivas: os 5 marcadores existem e são deliberados (r=4, preenchidos).
    const dots = Array.from(container.querySelectorAll<SVGElement>('.recharts-line-dot'))
    expect(dots).toHaveLength(5)
    dots.forEach((d) => {
      expect(d.getAttribute('r')).toBe('4')
      expect(d.getAttribute('fill')).toBe('var(--color-card)')
    })
    // O card explica por que não há linha — em vez de parecer quebrado.
    expect(screen.getByText(/período de um único dia/i)).toBeInTheDocument()
    // Negativa acompanhada das positivas acima: não há linha a traçar mesmo.
    expect(curvas(container)).toHaveLength(0)
    // E o card NÃO caiu no empty: há movimentação no dia.
    expect(screen.queryByText(/sem movimentação registrada/i)).toBeNull()
  })

  it('empty honesto continua mandando: dias todos-zero → sem gráfico e sem legenda', () => {
    setHook({
      days: [
        { data: '2026-06-01', novos: 0, emAndamento: 0, resolvidos: 0, cancelados: 0, emAberto: 0 },
      ],
    })
    const { container } = render(<SupportMovimentacaoSection {...props} />)

    expect(screen.getByText(/sem movimentação registrada/i)).toBeInTheDocument()
    expect(curvas(container)).toHaveLength(0)
    expect(screen.queryByRole('button', { name: 'Todas' })).toBeNull()
  })
})
