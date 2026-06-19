import { describe, expect, it } from 'vitest'
import { loginSchema } from './authSchema'

describe('loginSchema', () => {
  it('aceita credenciais válidas', () => {
    const result = loginSchema.safeParse({
      email: 'usuario@exemplo.com',
      password: 'senha123',
    })
    expect(result.success).toBe(true)
  })

  it('rejeita e-mail inválido', () => {
    const result = loginSchema.safeParse({
      email: 'nao-e-email',
      password: 'senha123',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const emailErrors = result.error.issues.filter((i) => i.path[0] === 'email')
      expect(emailErrors.length).toBeGreaterThan(0)
      expect(emailErrors[0].message).toBe('Informe um e-mail válido.')
    }
  })

  it('rejeita e-mail vazio', () => {
    const result = loginSchema.safeParse({
      email: '',
      password: 'senha123',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const emailErrors = result.error.issues.filter((i) => i.path[0] === 'email')
      expect(emailErrors.length).toBeGreaterThan(0)
      expect(emailErrors[0].message).toBe('O e-mail é obrigatório.')
    }
  })

  it('rejeita senha vazia', () => {
    const result = loginSchema.safeParse({
      email: 'usuario@exemplo.com',
      password: '',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const passwordErrors = result.error.issues.filter((i) => i.path[0] === 'password')
      expect(passwordErrors.length).toBeGreaterThan(0)
      expect(passwordErrors[0].message).toBe('A senha é obrigatória.')
    }
  })

  it('rejeita senha com mais de 128 caracteres', () => {
    const senhaLonga = 'a'.repeat(129)
    const result = loginSchema.safeParse({
      email: 'usuario@exemplo.com',
      password: senhaLonga,
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const passwordErrors = result.error.issues.filter((i) => i.path[0] === 'password')
      expect(passwordErrors.length).toBeGreaterThan(0)
      expect(passwordErrors[0].message).toBe('A senha deve ter no máximo 128 caracteres.')
    }
  })

  it('aceita senha com exatamente 128 caracteres', () => {
    const senha128 = 'a'.repeat(128)
    const result = loginSchema.safeParse({
      email: 'usuario@exemplo.com',
      password: senha128,
    })
    expect(result.success).toBe(true)
  })

  it('rejeita quando ambos os campos estão ausentes', () => {
    const result = loginSchema.safeParse({})
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.length).toBeGreaterThanOrEqual(2)
    }
  })
})
