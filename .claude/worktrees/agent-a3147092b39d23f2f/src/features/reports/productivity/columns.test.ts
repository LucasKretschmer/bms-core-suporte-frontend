import { describe, expect, it } from 'vitest'
import { productivityColumns } from './columns'
import type { AgentMetricDto } from '../shared/types/reports'

const sampleRow: AgentMetricDto = {
  userId: 1,
  nome: 'João Silva',
  equipe: 'Equipe A',
  nAtendimentos: 42,
  totalSegundos: 7200,
  ahtSegundos: 600,
  mediaPausas: 1.5,
}

describe('productivityColumns — estrutura', () => {
  it('tem exatamente 6 colunas na ordem correta', () => {
    const keys = productivityColumns.map((c) => c.key)
    expect(keys).toEqual([
      'nome',
      'equipe',
      'nAtendimentos',
      'totalSegundos',
      'ahtSegundos',
      'mediaPausas',
    ])
  })

  it('todas as colunas são sortáveis', () => {
    productivityColumns.forEach((col) => {
      expect(col.sortable).toBe(true)
    })
  })

  it('colunas de texto têm align="left"', () => {
    const textCols = ['nome', 'equipe']
    textCols.forEach((key) => {
      const col = productivityColumns.find((c) => c.key === key)
      expect(col?.align).toBe('left')
    })
  })

  it('colunas numéricas têm align="right"', () => {
    const rightCols = ['nAtendimentos', 'totalSegundos', 'ahtSegundos', 'mediaPausas']
    rightCols.forEach((key) => {
      const col = productivityColumns.find((c) => c.key === key)
      expect(col?.align).toBe('right')
    })
  })

  it('sortKeys casam com a whitelist do backend', () => {
    const expectedSortKeys: Record<string, string> = {
      nome: 'nome',
      equipe: 'equipe',
      nAtendimentos: 'natendimentos',
      totalSegundos: 'totalsegundos',
      ahtSegundos: 'ahtsegundos',
      mediaPausas: 'mediapausas',
    }
    productivityColumns.forEach((col) => {
      expect(col.sortKey).toBe(expectedSortKeys[col.key])
    })
  })
})

describe('productivityColumns — accessors', () => {
  it('coluna "Analista" exibe o nome', () => {
    const col = productivityColumns.find((c) => c.key === 'nome')!
    expect(col.accessor(sampleRow)).toBe('João Silva')
  })

  it('coluna "Equipe" exibe o nome da equipe', () => {
    const col = productivityColumns.find((c) => c.key === 'equipe')!
    expect(col.accessor(sampleRow)).toBe('Equipe A')
  })

  it('coluna "Equipe" exibe "—" quando null', () => {
    const col = productivityColumns.find((c) => c.key === 'equipe')!
    expect(col.accessor({ ...sampleRow, equipe: null })).toBe('—')
  })

  it('coluna "Atendimentos" exibe número inteiro', () => {
    const col = productivityColumns.find((c) => c.key === 'nAtendimentos')!
    expect(col.accessor(sampleRow)).toBe(42)
  })

  it('coluna "Tempo Total" formata segundos', () => {
    const col = productivityColumns.find((c) => c.key === 'totalSegundos')!
    // 7200s = 2h 0m
    expect(col.accessor(sampleRow)).toBe('2h 0m')
  })

  it('coluna "AHT" formata segundos quando não null', () => {
    const col = productivityColumns.find((c) => c.key === 'ahtSegundos')!
    // 600s = 0h 10m
    expect(col.accessor(sampleRow)).toBe('0h 10m')
  })

  it('coluna "AHT" exibe "—" quando ahtSegundos é null', () => {
    const col = productivityColumns.find((c) => c.key === 'ahtSegundos')!
    expect(col.accessor({ ...sampleRow, ahtSegundos: null })).toBe('—')
  })

  it('coluna "Média de Pausas" formata decimal', () => {
    const col = productivityColumns.find((c) => c.key === 'mediaPausas')!
    // 1.5 → "1,5" (pt-BR)
    const result = col.accessor(sampleRow)
    expect(typeof result).toBe('string')
    expect(result).toMatch(/1[,.]5/)
  })

  it('coluna "Média de Pausas" exibe "—" quando null', () => {
    const col = productivityColumns.find((c) => c.key === 'mediaPausas')!
    expect(col.accessor({ ...sampleRow, mediaPausas: null })).toBe('—')
  })
})
