import { describe, expect, it } from 'vitest'
import { getPercentClass, planConsumptionColumns } from './columns'

describe('getPercentClass — cor do % do plano', () => {
  it('retorna "green" quando valor < 80', () => {
    expect(getPercentClass(0)).toBe('green')
    expect(getPercentClass(50)).toBe('green')
    expect(getPercentClass(79.9)).toBe('green')
  })

  it('retorna "yellow" quando 80 <= valor < 95', () => {
    expect(getPercentClass(80)).toBe('yellow')
    expect(getPercentClass(87)).toBe('yellow')
    expect(getPercentClass(94.9)).toBe('yellow')
  })

  it('retorna "red" quando valor >= 95', () => {
    expect(getPercentClass(95)).toBe('red')
    expect(getPercentClass(100)).toBe('red')
    // pode exceder 100%
    expect(getPercentClass(120)).toBe('red')
    expect(getPercentClass(150)).toBe('red')
  })

  it('retorna "neutral" quando valor é null', () => {
    expect(getPercentClass(null)).toBe('neutral')
  })
})

describe('planConsumptionColumns — estrutura', () => {
  it('tem exatamente 11 colunas na ordem correta', () => {
    const keys = planConsumptionColumns.map((c) => c.key)
    expect(keys).toEqual([
      'cnpj',
      'nomeFantasia',
      'razaoSocial',
      'nomePlano',
      'qtdePlanoHoras',
      'horasUsadas',
      'horasRestantes',
      'horasAdicionais',
      'percentualPlano',
      'horasFaturaveis',
      'horasAnalise',
    ])
  })

  it('todas as colunas são sortáveis', () => {
    planConsumptionColumns.forEach((col) => {
      expect(col.sortable).toBe(true)
    })
  })

  it('colunas numéricas têm align="right"', () => {
    const rightCols = ['qtdePlanoHoras', 'horasUsadas', 'horasRestantes', 'horasAdicionais', 'percentualPlano', 'horasFaturaveis', 'horasAnalise']
    rightCols.forEach((key) => {
      const col = planConsumptionColumns.find((c) => c.key === key)
      expect(col?.align).toBe('right')
    })
  })

  it('colunas de texto têm align="left"', () => {
    const leftCols = ['cnpj', 'nomeFantasia', 'razaoSocial', 'nomePlano']
    leftCols.forEach((key) => {
      const col = planConsumptionColumns.find((c) => c.key === key)
      expect(col?.align).toBe('left')
    })
  })

  it('sortKeys casam com a whitelist do backend', () => {
    const expectedSortKeys: Record<string, string> = {
      cnpj: 'cnpj',
      nomeFantasia: 'nomefantasia',
      razaoSocial: 'razaosocial',
      nomePlano: 'nomeplano',
      qtdePlanoHoras: 'qtdeplano',
      horasUsadas: 'horasusadas',
      horasRestantes: 'horasrestantes',
      horasAdicionais: 'horasadicionais',
      percentualPlano: 'percentual',
      horasFaturaveis: 'horasfaturaveis',
      horasAnalise: 'horasanalise',
    }
    planConsumptionColumns.forEach((col) => {
      expect(col.sortKey).toBe(expectedSortKeys[col.key])
    })
  })

  it('colunas com tooltip ⓘ usam headerInfo (fora do botão de ordenação, 098 r2)', () => {
    const tooltipCols = ['horasAdicionais', 'horasFaturaveis', 'horasAnalise']
    tooltipCols.forEach((key) => {
      const col = planConsumptionColumns.find((c) => c.key === key)
      // O tooltip é declarado como texto em `headerInfo` — não como um
      // InfoIcon embutido em `headerNode` (que geraria <button> em <button>).
      expect(typeof col?.headerInfo).toBe('string')
      expect(col?.headerInfo?.length).toBeGreaterThan(0)
      expect(col?.headerNode).toBeUndefined()
    })
  })

  it('coluna CNPJ formata máscara corretamente', () => {
    const col = planConsumptionColumns.find((c) => c.key === 'cnpj')!
    const row = {
      clientId: 1,
      cnpj: '12345678000195',
      nomeFantasia: null,
      razaoSocial: null,
      nomePlano: null,
      qtdePlanoHoras: 0,
      horasUsadas: 0,
      horasRestantes: 0,
      horasAdicionais: 0,
      percentualPlano: null,
      horasFaturaveis: 0,
      horasAnalise: 0,
    }
    expect(col.accessor(row)).toBe('12.345.678/0001-95')
  })

  it('coluna CNPJ exibe "—" quando null', () => {
    const col = planConsumptionColumns.find((c) => c.key === 'cnpj')!
    const row = {
      clientId: 1,
      cnpj: null,
      nomeFantasia: null,
      razaoSocial: null,
      nomePlano: null,
      qtdePlanoHoras: 0,
      horasUsadas: 0,
      horasRestantes: 0,
      horasAdicionais: 0,
      percentualPlano: null,
      horasFaturaveis: 0,
      horasAnalise: 0,
    }
    expect(col.accessor(row)).toBe('—')
  })
})
