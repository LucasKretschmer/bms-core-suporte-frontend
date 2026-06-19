import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getChartTokens, getChartPalette, resetChartTokensCache } from './chartTokens'

// Mock de getComputedStyle para simular as CSS vars do @theme
function makeGetComputedStyle(valueMap: Record<string, string>) {
  return (_el: Element) => ({
    getPropertyValue: (prop: string) => valueMap[prop] ?? '',
  })
}

const MOCK_COLORS: Record<string, string> = {
  '--color-chart-1': '#2563EB',
  '--color-chart-2': '#16A34A',
  '--color-chart-3': '#D97706',
  '--color-chart-4': '#DC2626',
  '--color-chart-5': '#7C3AED',
  '--color-chart-6': '#0891B2',
  '--color-chart-7': '#DB2777',
  '--color-chart-8': '#65A30D',
  '--color-chart-novos': '#2563EB',
  '--color-chart-andamento': '#D97706',
  '--color-chart-resolvidos': '#16A34A',
  '--color-chart-cancelados': '#6B7280',
  '--color-chart-aberto': '#DC2626',
  '--color-chart-verde': '#16A34A',
  '--color-chart-amarelo': '#D97706',
  '--color-chart-vermelho': '#DC2626',
}

describe('chartTokens', () => {
  let originalGetComputedStyle: typeof getComputedStyle

  beforeEach(() => {
    resetChartTokensCache()
    originalGetComputedStyle = globalThis.getComputedStyle
    // @ts-expect-error — sobrescrevendo para teste
    globalThis.getComputedStyle = makeGetComputedStyle(MOCK_COLORS)
  })

  afterEach(() => {
    globalThis.getComputedStyle = originalGetComputedStyle
    resetChartTokensCache()
  })

  it('getChartTokens retorna todos os tokens esperados', () => {
    const tokens = getChartTokens()

    const expectedKeys = [
      'chart-1', 'chart-2', 'chart-3', 'chart-4',
      'chart-5', 'chart-6', 'chart-7', 'chart-8',
      'chart-novos', 'chart-andamento', 'chart-resolvidos',
      'chart-cancelados', 'chart-aberto',
      'chart-verde', 'chart-amarelo', 'chart-vermelho',
    ] as const

    for (const key of expectedKeys) {
      expect(tokens).toHaveProperty(key)
    }
  })

  it('nenhum valor de token é string vazia', () => {
    const tokens = getChartTokens()
    for (const [key, value] of Object.entries(tokens)) {
      expect(value, `Token "${key}" não deve ser vazio`).not.toBe('')
    }
  })

  it('é memoizado — getComputedStyle chamado apenas uma vez', () => {
    const spy = vi.fn((el: Element) => ({
      getPropertyValue: (prop: string) => MOCK_COLORS[prop] ?? '',
    }))
    // @ts-expect-error — sobrescrevendo para teste
    globalThis.getComputedStyle = spy

    getChartTokens()
    getChartTokens()
    getChartTokens()

    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('resetChartTokensCache invalida o cache', () => {
    const spy = vi.fn((el: Element) => ({
      getPropertyValue: (prop: string) => MOCK_COLORS[prop] ?? '',
    }))
    // @ts-expect-error — sobrescrevendo para teste
    globalThis.getComputedStyle = spy

    getChartTokens()
    resetChartTokensCache()
    getChartTokens()

    expect(spy).toHaveBeenCalledTimes(2)
  })

  it('getChartPalette retorna exatamente 8 elementos', () => {
    const palette = getChartPalette()
    expect(palette).toHaveLength(8)
  })

  it('getChartPalette — todos elementos não vazios', () => {
    const palette = getChartPalette()
    for (const color of palette) {
      expect(color).not.toBe('')
    }
  })

  it('chart-novos e chart-andamento têm valores distintos', () => {
    const tokens = getChartTokens()
    expect(tokens['chart-novos']).not.toBe(tokens['chart-andamento'])
  })
})
