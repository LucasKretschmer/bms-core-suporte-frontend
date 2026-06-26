import { describe, expect, it } from 'vitest'
import { defaultTicketScope } from './reportScope'

describe('defaultTicketScope', () => {
  it("retorna 'all' para Coordenador ou acima", () => {
    expect(defaultTicketScope(true)).toBe('all')
  })

  it("retorna 'mine' para Atendente (não coordenador)", () => {
    expect(defaultTicketScope(false)).toBe('mine')
  })
})
