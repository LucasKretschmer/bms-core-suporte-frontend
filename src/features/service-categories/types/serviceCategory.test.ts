import { describe, expect, it } from 'vitest'
import { newCategorySchema } from './serviceCategory'

describe('newCategorySchema', () => {
  it('rejeita nome vazio', () => {
    const r = newCategorySchema.safeParse({ nome: '' })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.issues[0].message).toBe('Informe o nome da categoria.')
  })

  it('rejeita nome só com espaços', () => {
    const r = newCategorySchema.safeParse({ nome: '   ' })
    expect(r.success).toBe(false)
  })

  it('rejeita nome com mais de 120 caracteres', () => {
    const r = newCategorySchema.safeParse({ nome: 'a'.repeat(121) })
    expect(r.success).toBe(false)
    if (!r.success)
      expect(r.error.issues[0].message).toBe('O nome deve ter no máximo 120 caracteres.')
  })

  it('aceita nome válido e aplica trim', () => {
    const r = newCategorySchema.safeParse({ nome: '  Consultoria  ' })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.nome).toBe('Consultoria')
  })
})
