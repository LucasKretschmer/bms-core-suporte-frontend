import { describe, expect, it } from 'vitest'
import { formatTime } from './formatters'

describe('formatTime', () => {
  it('formata ISO Z em HH:mm (fuso America/Sao_Paulo)', () => {
    // 12:30 UTC = 09:30 em São Paulo (UTC-3, sem DST em junho)
    expect(formatTime('2026-06-19T12:30:00Z')).toBe('09:30')
  })

  it('retorna "—" para ISO inválido', () => {
    expect(formatTime('invalido')).toBe('—')
  })
})
