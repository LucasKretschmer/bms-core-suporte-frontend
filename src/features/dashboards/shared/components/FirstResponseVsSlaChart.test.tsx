/**
 * Testes de FirstResponseVsSlaChart (#5).
 * Cobre os estados condicionais: loading, empty honesto (ambos null e parcial),
 * e render com dados válidos. Lógica de branch suficiente para justificar teste.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FirstResponseVsSlaChart } from './FirstResponseVsSlaChart'

// Mock de getChartTokens para evitar dependência de CSS vars no jsdom.
vi.mock('../utils/chartTokens', () => ({
  getChartTokens: () => ({
    'chart-verde': '#16A34A',
    'chart-amarelo': '#D97706',
    'chart-vermelho': '#DC2626',
  }),
  getChartPalette: () => ['#2563EB', '#16A34A', '#D97706'],
  resetChartTokensCache: () => {},
}))

describe('FirstResponseVsSlaChart', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('ambos null → renderiza empty honesto (Service Hub)', () => {
    render(<FirstResponseVsSlaChart respondidosNoPrazo={null} respondidosForaDoPrazo={null} />)
    expect(screen.getByText(/service hub/i)).toBeInTheDocument()
  })

  it('estado parcial (um lado null) → renderiza empty honesto, sem fingir zero respostas', () => {
    render(<FirstResponseVsSlaChart respondidosNoPrazo={12} respondidosForaDoPrazo={null} />)
    expect(screen.getByText(/service hub/i)).toBeInTheDocument()
    // Não deve renderizar o valor parcial como se fosse gráfico válido.
    expect(screen.queryByText('Respondidos no prazo')).not.toBeInTheDocument()
  })

  it('estado parcial inverso (no prazo null) → empty honesto', () => {
    render(<FirstResponseVsSlaChart respondidosNoPrazo={null} respondidosForaDoPrazo={5} />)
    expect(screen.getByText(/service hub/i)).toBeInTheDocument()
  })

  it('ambos número → renderiza o gráfico sem crash (não empty)', () => {
    render(<FirstResponseVsSlaChart respondidosNoPrazo={40} respondidosForaDoPrazo={8} />)
    expect(screen.queryByText(/service hub/i)).not.toBeInTheDocument()
  })

  it('ambos zero → renderiza o gráfico (zero é dado válido, não empty)', () => {
    render(<FirstResponseVsSlaChart respondidosNoPrazo={0} respondidosForaDoPrazo={0} />)
    expect(screen.queryByText(/service hub/i)).not.toBeInTheDocument()
  })

  it('isLoading=true → renderiza skeleton, não o gráfico nem o empty', () => {
    render(<FirstResponseVsSlaChart respondidosNoPrazo={null} respondidosForaDoPrazo={null} isLoading />)
    const skeleton = document.querySelector('[aria-busy="true"]')
    expect(skeleton).toBeTruthy()
    expect(screen.queryByText(/service hub/i)).not.toBeInTheDocument()
  })
})
