import { describe, expect, it } from 'vitest'
import { cancelTimeEntrySchema, CANCEL_REASON_MIN } from './cancelTimeEntrySchema'

describe('cancelTimeEntrySchema', () => {
  it('rejeita motivo vazio', () => {
    const result = cancelTimeEntrySchema.safeParse({ reason: '' })
    expect(result.success).toBe(false)
  })

  it('rejeita motivo só com espaços (após trim)', () => {
    const result = cancelTimeEntrySchema.safeParse({ reason: '          ' })
    expect(result.success).toBe(false)
  })

  it('rejeita motivo abaixo do mínimo de 10 caracteres', () => {
    const result = cancelTimeEntrySchema.safeParse({ reason: 'abc' })
    expect(result.success).toBe(false)
    expect(CANCEL_REASON_MIN).toBe(10)
  })

  it('aceita motivo no mínimo de 10 caracteres', () => {
    const result = cancelTimeEntrySchema.safeParse({ reason: '0123456789' })
    expect(result.success).toBe(true)
  })

  it('aplica trim no motivo válido', () => {
    const result = cancelTimeEntrySchema.safeParse({ reason: '  lançamento duplicado  ' })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.reason).toBe('lançamento duplicado')
  })

  it('rejeita motivo acima do máximo de 500', () => {
    const result = cancelTimeEntrySchema.safeParse({ reason: 'a'.repeat(501) })
    expect(result.success).toBe(false)
  })
})
