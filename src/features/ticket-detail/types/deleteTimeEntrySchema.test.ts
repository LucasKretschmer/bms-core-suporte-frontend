import { describe, expect, it } from 'vitest'
import { deleteTimeEntrySchema, DELETE_REASON_MIN } from './deleteTimeEntrySchema'

describe('deleteTimeEntrySchema', () => {
  it('rejeita motivo vazio', () => {
    const result = deleteTimeEntrySchema.safeParse({ reason: '' })
    expect(result.success).toBe(false)
  })

  it('rejeita motivo só com espaços (após trim)', () => {
    const result = deleteTimeEntrySchema.safeParse({ reason: '    ' })
    expect(result.success).toBe(false)
  })

  it('rejeita motivo abaixo do mínimo de caracteres', () => {
    const result = deleteTimeEntrySchema.safeParse({ reason: 'abc' })
    expect(result.success).toBe(false)
    expect(DELETE_REASON_MIN).toBe(5)
  })

  it('aceita motivo no mínimo de caracteres', () => {
    const result = deleteTimeEntrySchema.safeParse({ reason: 'erro!' })
    expect(result.success).toBe(true)
  })

  it('aplica trim no motivo válido', () => {
    const result = deleteTimeEntrySchema.safeParse({ reason: '  lançamento duplicado  ' })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.reason).toBe('lançamento duplicado')
  })

  it('rejeita motivo acima do máximo', () => {
    const result = deleteTimeEntrySchema.safeParse({ reason: 'a'.repeat(501) })
    expect(result.success).toBe(false)
  })
})
