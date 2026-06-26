import { describe, expect, it, beforeEach, vi } from 'vitest'
import { tokenStore } from './tokenStore'

describe('tokenStore', () => {
  beforeEach(() => {
    tokenStore.clear()
    vi.useRealTimers()
  })

  it('retorna null quando não há token', () => {
    expect(tokenStore.get()).toBeNull()
  })

  it('isValid retorna false sem token', () => {
    expect(tokenStore.isValid()).toBe(false)
  })

  it('guarda e retorna token válido', () => {
    const futureDate = new Date(Date.now() + 3600_000).toISOString()
    tokenStore.set('meu-token', futureDate)
    expect(tokenStore.get()).toBe('meu-token')
    expect(tokenStore.isValid()).toBe(true)
  })

  it('retorna null quando token está expirado', () => {
    // Expiração no passado
    const pastDate = new Date(Date.now() - 1000).toISOString()
    tokenStore.set('token-expirado', pastDate)
    expect(tokenStore.get()).toBeNull()
  })

  it('isValid retorna false com token expirado', () => {
    const pastDate = new Date(Date.now() - 1000).toISOString()
    tokenStore.set('token-expirado', pastDate)
    expect(tokenStore.isValid()).toBe(false)
  })

  it('clear remove token da memória', () => {
    const futureDate = new Date(Date.now() + 3600_000).toISOString()
    tokenStore.set('meu-token', futureDate)
    expect(tokenStore.isValid()).toBe(true)
    tokenStore.clear()
    expect(tokenStore.get()).toBeNull()
    expect(tokenStore.isValid()).toBe(false)
  })
})
