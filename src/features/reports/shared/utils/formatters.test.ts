import { describe, expect, it } from 'vitest'
import {
  formatClientName,
  formatDate,
  formatHours,
  formatMonth,
  formatPercent,
  formatSeconds,
  hoursToSeconds,
  secondsToHours,
} from './formatters'

describe('formatSeconds', () => {
  it('converte 3723 segundos para "1h 2m"', () => {
    expect(formatSeconds(3723)).toBe('1h 2m')
  })

  it('converte 0 segundos para "0h 0m"', () => {
    expect(formatSeconds(0)).toBe('0h 0m')
  })

  it('converte 3600 segundos para "1h 0m"', () => {
    expect(formatSeconds(3600)).toBe('1h 0m')
  })

  it('trata segundos negativos como zero', () => {
    expect(formatSeconds(-100)).toBe('0h 0m')
  })

  it('converte 90 segundos para "0h 1m"', () => {
    expect(formatSeconds(90)).toBe('0h 1m')
  })
})

describe('secondsToHours', () => {
  it('converte 3600 para 1.0', () => {
    expect(secondsToHours(3600)).toBe(1.0)
  })

  it('converte 5400 para 1.5', () => {
    expect(secondsToHours(5400)).toBe(1.5)
  })
})

describe('formatHours', () => {
  it('converte 1.5 horas para "1h 30m"', () => {
    expect(formatHours(1.5)).toBe('1h 30m')
  })

  it('converte 0 para "0h 0m"', () => {
    expect(formatHours(0)).toBe('0h 0m')
  })
})

describe('hoursToSeconds (134 — inverso exato de secondsToHours)', () => {
  it('2,7333333 h → 9840 s (Math.round, o MESMO de formatHours — nunca floor)', () => {
    expect(hoursToSeconds(2.7333333)).toBe(9840)
  })

  it('26,5 h → 95400 s — sem teto de 24 h', () => {
    expect(hoursToSeconds(26.5)).toBe(95400)
  })

  it('é o inverso de secondsToHours para valores inteiros de segundo', () => {
    expect(hoursToSeconds(secondsToHours(9840))).toBe(9840)
  })
})

/**
 * T-TELA-1 (demanda 134): a TELA continua em "2h 44m". A demanda muda só o arquivo
 * baixado. Fica vermelho se alguém "resolver" a 134 mexendo no formatador de exibição.
 */
describe('T-TELA-1 · o formato de tela não mudou com a 134', () => {
  it('formatSeconds(9840) continua "2h 44m" e formatHours(2.7333333) também', () => {
    expect(formatSeconds(9840)).toBe('2h 44m')
    expect(formatHours(2.7333333)).toBe('2h 44m')
  })

  it('a tela NÃO passa a exibir o formato calculável do export', () => {
    // Negativa com companheira positiva na mesma execução (a linha acima).
    expect(formatSeconds(95400)).toBe('26h 30m')
    expect(formatSeconds(95400)).not.toBe('26:30:00')
  })
})

describe('formatDate', () => {
  it('formata ISO em data pt-BR', () => {
    const result = formatDate('2024-03-15T10:30:00Z')
    // Formato dd/MM/yyyy
    expect(result).toMatch(/^\d{2}\/\d{2}\/\d{4}$/)
  })

  it('retorna "—" para string inválida', () => {
    expect(formatDate('data-invalida')).toBe('—')
  })
})

describe('formatMonth', () => {
  it('formata YYYY-MM como mês por extenso capitalizado', () => {
    const result = formatMonth('2024-03')
    expect(result.toLowerCase()).toContain('mar')
    // Começa com maiúscula
    expect(result[0]).toBe(result[0].toUpperCase())
  })
})

describe('formatPercent', () => {
  it('formata 85.3 como percentual pt-BR com 1 casa', () => {
    expect(formatPercent(85.3)).toContain('%')
  })

  it('retorna "—" para null', () => {
    expect(formatPercent(null)).toBe('—')
  })

  it('retorna "—" para undefined', () => {
    expect(formatPercent(undefined)).toBe('—')
  })
})

describe('formatClientName', () => {
  it('prefere nomeFantasia quando disponível', () => {
    expect(
      formatClientName({ nomeFantasia: 'Fantasia LTDA', razaoSocial: 'Razão Social LTDA' }),
    ).toBe('Fantasia LTDA')
  })

  it('usa razaoSocial quando nomeFantasia é null', () => {
    expect(
      formatClientName({ nomeFantasia: null, razaoSocial: 'Razão Social LTDA' }),
    ).toBe('Razão Social LTDA')
  })

  it('retorna "—" quando ambos são null', () => {
    expect(formatClientName({ nomeFantasia: null, razaoSocial: null })).toBe('—')
  })

  it('usa razaoSocial quando nomeFantasia é string vazia', () => {
    expect(
      formatClientName({ nomeFantasia: '', razaoSocial: 'Razão Social LTDA' }),
    ).toBe('Razão Social LTDA')
  })

  it('usa razaoSocial quando nomeFantasia é só espaços/whitespace', () => {
    expect(
      formatClientName({ nomeFantasia: '   ', razaoSocial: 'Razão Social LTDA' }),
    ).toBe('Razão Social LTDA')
  })

  it('retorna "—" quando ambos são string vazia/whitespace', () => {
    expect(formatClientName({ nomeFantasia: '  ', razaoSocial: '' })).toBe('—')
  })
})
