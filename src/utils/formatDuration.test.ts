import { describe, expect, it } from 'vitest'
import { formatDuration } from './formatDuration'

describe('formatDuration', () => {
  it('retorna "—" para null', () => {
    expect(formatDuration(null)).toBe('—')
  })

  it('retorna ms quando menor que 1s', () => {
    expect(formatDuration(500)).toBe('500ms')
  })

  it('retorna ms para 0', () => {
    expect(formatDuration(0)).toBe('0ms')
  })

  it('retorna ms para 999', () => {
    expect(formatDuration(999)).toBe('999ms')
  })

  it('retorna segundos entre 1s e 1min', () => {
    expect(formatDuration(2500)).toBe('2.5s')
  })

  it('retorna exatamente 1.0s para 1000ms', () => {
    expect(formatDuration(1000)).toBe('1.0s')
  })

  it('retorna minutos e segundos para exato 1min', () => {
    expect(formatDuration(60000)).toBe('1m 0s')
  })

  it('retorna minutos e segundos para 90500ms', () => {
    expect(formatDuration(90500)).toBe('1m 31s')
  })

  it('retorna minutos e segundos para 2 minutos exatos', () => {
    expect(formatDuration(120000)).toBe('2m 0s')
  })

  it('arredonda segundos corretamente (59999ms → 0m 60s ou 1m 0s)', () => {
    // 59999ms < 60000ms portanto cai no ramo de segundos: 59.999 → "60.0s"
    // NOTA: este é o comportamento esperado pelo utilitário — 59.999 usa toFixed(1)
    expect(formatDuration(59999)).toBe('60.0s')
  })
})
