/**
 * Testes de PlanHealthChart.
 *
 * Demanda 015 — a tabela de clientes abaixo do gráfico foi removida.
 * Estes testes garantem que NENHUMA <table> é renderizada (regressão da 015)
 * e que os estados de loading/empty continuam funcionando.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PlanHealthChart } from './PlanHealthChart'
import type { PlanHealthSummaryDto } from '../types/metrics'

vi.mock('../utils/chartTokens', () => ({
  getChartTokens: () => ({
    'chart-verde': '#16A34A',
    'chart-amarelo': '#D97706',
    'chart-vermelho': '#DC2626',
  }),
}))

const SUMMARY: PlanHealthSummaryDto = {
  totalVerde: 5,
  totalAmarelo: 2,
  totalVermelho: 1,
}

describe('PlanHealthChart', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('não renderiza nenhuma tabela (015 — tabela vazia removida)', () => {
    const { container } = render(<PlanHealthChart summary={SUMMARY} />)
    expect(container.querySelector('table')).toBeNull()
  })

  it('summary nulo → renderiza empty state', () => {
    render(<PlanHealthChart summary={null} />)
    expect(screen.getByText(/sem dados de planos/i)).toBeInTheDocument()
  })

  it('isLoading=true → renderiza skeleton, não gráfico', () => {
    render(<PlanHealthChart summary={SUMMARY} isLoading />)
    expect(document.querySelector('[aria-busy="true"]')).toBeTruthy()
  })

  it('renderiza sem crash com summary válido', () => {
    expect(() => render(<PlanHealthChart summary={SUMMARY} />)).not.toThrow()
  })

  it('aceita height customizado', () => {
    expect(() =>
      render(<PlanHealthChart summary={SUMMARY} height={400} />),
    ).not.toThrow()
  })
})
