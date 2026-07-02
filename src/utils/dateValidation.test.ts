import { describe, expect, it } from 'vitest'
import { clampDayToMonth, isRangeValid, normalizeDateOnCommit } from './dateValidation'

describe('isRangeValid', () => {
  it('retorna true quando algum extremo é nulo (intervalo aberto)', () => {
    expect(isRangeValid(null, '2026-06-30')).toBe(true)
    expect(isRangeValid('2026-06-01', null)).toBe(true)
    expect(isRangeValid(null, null)).toBe(true)
    expect(isRangeValid(undefined, undefined)).toBe(true)
    expect(isRangeValid('', '2026-06-30')).toBe(true)
  })

  it('retorna true quando from <= to (mode date)', () => {
    expect(isRangeValid('2026-06-01', '2026-06-30')).toBe(true)
    expect(isRangeValid('2026-06-15', '2026-06-15')).toBe(true) // igual é válido
  })

  it('retorna false quando from > to (mode date)', () => {
    expect(isRangeValid('2026-06-30', '2026-06-01')).toBe(false)
    expect(isRangeValid('2026-07-01', '2026-06-30')).toBe(false)
  })

  it('trata o formato YYYY-MM (mode month)', () => {
    expect(isRangeValid('2026-06', '2026-07')).toBe(true)
    expect(isRangeValid('2026-06', '2026-06')).toBe(true)
    expect(isRangeValid('2026-07', '2026-06')).toBe(false)
    expect(isRangeValid('2027-01', '2026-12')).toBe(false)
  })
})

describe('clampDayToMonth', () => {
  it('corrige 31/06 para 30/06', () => {
    expect(clampDayToMonth('2026-06-31')).toBe('2026-06-30')
  })

  it('corrige 29/02 em ano não bissexto para 28/02', () => {
    expect(clampDayToMonth('2025-02-29')).toBe('2025-02-28')
  })

  it('mantém 29/02 em ano bissexto', () => {
    expect(clampDayToMonth('2024-02-29')).toBe('2024-02-29')
  })

  it('corrige 31/02 para 28/02 (ano não bissexto)', () => {
    expect(clampDayToMonth('2025-02-31')).toBe('2025-02-28')
  })

  it('corrige 31/04 para 30/04', () => {
    expect(clampDayToMonth('2026-04-31')).toBe('2026-04-30')
  })

  it('é idempotente para datas já válidas', () => {
    expect(clampDayToMonth('2026-06-15')).toBe('2026-06-15')
    expect(clampDayToMonth('2026-01-31')).toBe('2026-01-31')
    expect(clampDayToMonth('2026-12-31')).toBe('2026-12-31')
  })

  it('retorna a string original para entradas que não são YYYY-MM-DD', () => {
    expect(clampDayToMonth('')).toBe('')
    expect(clampDayToMonth('2026-06')).toBe('2026-06')
    expect(clampDayToMonth('abc')).toBe('abc')
  })

  it('não clampa mês fora do intervalo válido', () => {
    expect(clampDayToMonth('2026-13-01')).toBe('2026-13-01')
    expect(clampDayToMonth('2026-00-10')).toBe('2026-00-10')
  })
})

describe('normalizeDateOnCommit', () => {
  it('normaliza data com dia impossível', () => {
    expect(normalizeDateOnCommit('2026-06-31')).toBe('2026-06-30')
    expect(normalizeDateOnCommit('2025-02-29')).toBe('2025-02-28')
  })

  it('mantém data válida inalterada (idempotente)', () => {
    expect(normalizeDateOnCommit('2026-06-15')).toBe('2026-06-15')
  })

  it('mantém null/vazio', () => {
    expect(normalizeDateOnCommit(null)).toBeNull()
    expect(normalizeDateOnCommit('')).toBe('')
  })

  it('mantém formato YYYY-MM (month) inalterado', () => {
    expect(normalizeDateOnCommit('2026-06')).toBe('2026-06')
  })
})
