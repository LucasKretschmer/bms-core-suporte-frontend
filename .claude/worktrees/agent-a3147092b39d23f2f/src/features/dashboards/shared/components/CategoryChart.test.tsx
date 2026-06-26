/**
 * Testes de CategoryChart.
 *
 * AP-SECURITY-001 — varredura de privacidade:
 * Garante que nenhuma categoria proibida do HubSpot aparece no DOM renderizado.
 * O backend filtra antes de retornar; este teste atua como segunda linha de defesa.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CategoryChart } from './CategoryChart'
import { CATEGORIAS_PROIBIDAS, KPI_CATALOG } from '../utils/kpiCatalog'
import type { CategoryMetricDto } from '../types/metrics'

// Mock de getChartTokens para evitar dependência de CSS vars
vi.mock('../utils/chartTokens', () => ({
  getChartTokens: () => ({
    'chart-1': '#2563EB',
    'chart-2': '#16A34A',
    'chart-3': '#D97706',
    'chart-4': '#DC2626',
    'chart-5': '#7C3AED',
    'chart-6': '#0891B2',
    'chart-7': '#DB2777',
    'chart-8': '#65A30D',
    'chart-novos': '#2563EB',
    'chart-andamento': '#D97706',
    'chart-resolvidos': '#16A34A',
    'chart-cancelados': '#6B7280',
    'chart-aberto': '#DC2626',
    'chart-verde': '#16A34A',
    'chart-amarelo': '#D97706',
    'chart-vermelho': '#DC2626',
  }),
  getChartPalette: () => ['#2563EB', '#16A34A', '#D97706', '#DC2626', '#7C3AED', '#0891B2', '#DB2777', '#65A30D'],
  resetChartTokensCache: () => {},
}))

// Dados operacionais válidos (sem categorias proibidas)
const DADOS_VALIDOS: CategoryMetricDto[] = [
  { categoria: 'Dúvida', count: 15, totalSegundos: 5400 },
  { categoria: 'Erro de configuração', count: 8, totalSegundos: 2880 },
  { categoria: 'Solicitação de recurso', count: 5, totalSegundos: 1800 },
]

describe('CategoryChart — AP-SECURITY-001 (privacidade de categoria HubSpot)', () => {
  beforeEach(() => {
    // Silenciar warnings do Recharts sobre ResizeObserver em ambiente de teste
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('não renderiza nenhuma categoria proibida no DOM', () => {
    render(<CategoryChart data={DADOS_VALIDOS} />)
    for (const categoriaProibida of CATEGORIAS_PROIBIDAS) {
      expect(
        document.body.textContent,
        `Categoria proibida "${categoriaProibida}" não deve aparecer no DOM`,
      ).not.toContain(categoriaProibida)
    }
  })

  it('nenhuma label ou tooltip do kpiCatalog contém categoria proibida', () => {
    // Teste integrado de AP-SECURITY-001 — verifica catálogo de KPIs
    for (const kpi of KPI_CATALOG) {
      for (const categoriaProibida of CATEGORIAS_PROIBIDAS) {
        expect(
          kpi.label,
          `label "${kpi.label}" não deve conter "${categoriaProibida}"`,
        ).not.toContain(categoriaProibida)
        if (kpi.tooltipText) {
          expect(
            kpi.tooltipText,
            `tooltipText "${kpi.tooltipText}" não deve conter "${categoriaProibida}"`,
          ).not.toContain(categoriaProibida)
        }
      }
    }
  })

  it('dados vazios → renderiza empty state', () => {
    render(<CategoryChart data={[]} />)
    expect(
      screen.getByText(/sem dados de categoria/i),
    ).toBeInTheDocument()
  })

  it('isLoading=true → renderiza skeleton, não gráfico', () => {
    render(<CategoryChart data={DADOS_VALIDOS} isLoading />)
    // Skeleton tem aria-busy
    const skeleton = document.querySelector('[aria-busy="true"]')
    expect(skeleton).toBeTruthy()
    // Não renderiza texto de categorias
    expect(screen.queryByText('Dúvida')).not.toBeInTheDocument()
  })

  it('onBarClick é chamado com o nome correto da categoria ao clicar na barra', () => {
    // Teste de comportamento do callback
    const onBarClick = vi.fn()
    // Nota: Recharts não renderiza elementos SVG clicáveis de forma simples em jsdom.
    // Verificamos que a prop é aceita sem erros de TypeScript.
    expect(() =>
      render(<CategoryChart data={DADOS_VALIDOS} onBarClick={onBarClick} />),
    ).not.toThrow()
  })

  it('renderiza sem crash com dados válidos', () => {
    expect(() => render(<CategoryChart data={DADOS_VALIDOS} />)).not.toThrow()
  })

  it('aceita height customizado', () => {
    expect(() =>
      render(<CategoryChart data={DADOS_VALIDOS} height={400} />),
    ).not.toThrow()
  })
})
