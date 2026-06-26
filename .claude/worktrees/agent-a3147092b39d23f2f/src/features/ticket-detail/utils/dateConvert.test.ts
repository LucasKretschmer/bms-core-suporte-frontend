import { describe, expect, it } from 'vitest'
import { isoToLocalInput, localInputToIso } from './dateConvert'

/**
 * R3: conversão pela timezone LOCAL do navegador (Manager).
 * O round-trip preserva o instante absoluto independente do fuso da máquina de teste.
 */
describe('dateConvert', () => {
  it('isoToLocalInput retorna 16 chars no formato datetime-local', () => {
    const local = isoToLocalInput('2026-06-19T12:30:00Z')
    expect(local).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
  })

  it('isoToLocalInput retorna "" para ISO inválido', () => {
    expect(isoToLocalInput('nao-e-data')).toBe('')
  })

  it('localInputToIso retorna "" para valor vazio', () => {
    expect(localInputToIso('')).toBe('')
  })

  it('localInputToIso retorna "" para valor inválido', () => {
    expect(localInputToIso('xx')).toBe('')
  })

  it('round-trip isoToLocalInput → localInputToIso preserva o instante', () => {
    const original = '2026-06-19T12:30:00.000Z'
    const localValue = isoToLocalInput(original)
    const backToIso = localInputToIso(localValue)
    // Compara o instante absoluto (ms), tolerando diferença de segundos/milis.
    expect(new Date(backToIso).getTime()).toBe(new Date(original).getTime())
  })
})
