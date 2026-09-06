import { describe, expect, it } from 'vitest'
import {
  editCategorySchema,
  MAX_CATEGORY_NAME_LENGTH,
  newCategorySchema,
} from './serviceCategory'

/**
 * 123/FE-2 — o limite era **120** aqui e **255** no backend
 * (`ServiceCategoryValidators.cs:13,24` + coluna `nome` `HasMaxLength(255)`).
 * A divergência foi resolvida a favor do backend, que é a fonte de verdade; estes testes
 * travam o novo limite nas DUAS pontas (aceita 255, recusa 256) — asserção só do lado que
 * recusa passaria também com o limite antigo.
 */
describe('limite de caracteres alinhado ao backend', () => {
  it('a constante vale 255 — o mesmo MaximumLength do validator e da coluna', () => {
    expect(MAX_CATEGORY_NAME_LENGTH).toBe(255)
  })

  it('aceita exatamente 255 caracteres (o limite antigo de 120 reprovaria aqui)', () => {
    expect(newCategorySchema.safeParse({ nome: 'a'.repeat(255) }).success).toBe(true)
  })

  it('recusa 256 caracteres', () => {
    const r = newCategorySchema.safeParse({ nome: 'a'.repeat(256) })
    expect(r.success).toBe(false)
    if (!r.success)
      expect(r.error.issues[0].message).toBe('O nome deve ter no máximo 255 caracteres.')
  })

  it('a mensagem cita o MESMO número da constante (texto e regra da mesma fonte)', () => {
    const r = newCategorySchema.safeParse({ nome: 'a'.repeat(MAX_CATEGORY_NAME_LENGTH + 1) })
    expect(r.success).toBe(false)
    if (!r.success)
      expect(r.error.issues[0].message).toContain(String(MAX_CATEGORY_NAME_LENGTH))
  })
})

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

  it('aceita nome válido e aplica trim', () => {
    const r = newCategorySchema.safeParse({ nome: '  Consultoria  ' })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.nome).toBe('Consultoria')
  })
})

describe('editCategorySchema (renomear)', () => {
  it('rejeita nome vazio com a mesma mensagem da criação', () => {
    const r = editCategorySchema.safeParse({ nome: '   ' })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.issues[0].message).toBe('Informe o nome da categoria.')
  })

  it('aplica trim — o PUT nunca leva espaço nas pontas', () => {
    const r = editCategorySchema.safeParse({ nome: '  Plantão  ' })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.nome).toBe('Plantão')
  })

  it('usa o mesmo limite da criação (o backend usa o mesmo validator para os dois)', () => {
    expect(editCategorySchema.safeParse({ nome: 'a'.repeat(255) }).success).toBe(true)
    expect(editCategorySchema.safeParse({ nome: 'a'.repeat(256) }).success).toBe(false)
  })
})
