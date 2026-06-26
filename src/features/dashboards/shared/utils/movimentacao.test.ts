/**
 * Testes da lógica pura de empty honesto da Movimentação Diária (#1).
 * AP-FRONTEND-006: testar função pura em vez do render do Recharts.
 */

import { describe, it, expect } from 'vitest'
import { temMovimento, isMovimentacaoEmpty } from './movimentacao'
import type { DailyDataPointDto } from '../types/metrics'

function ponto(overrides: Partial<DailyDataPointDto> = {}): DailyDataPointDto {
  return {
    data: '2026-06-01',
    novos: 0,
    emAndamento: 0,
    resolvidos: 0,
    cancelados: 0,
    emAberto: 0,
    ...overrides,
  }
}

describe('temMovimento', () => {
  it('retorna false para lista vazia', () => {
    expect(temMovimento([])).toBe(false)
  })

  it('retorna false quando todos os dias têm todas as séries em zero', () => {
    const days = [ponto({ data: '2026-06-01' }), ponto({ data: '2026-06-02' })]
    expect(temMovimento(days)).toBe(false)
  })

  it('retorna true quando ao menos um dia tem alguma série > 0', () => {
    const days = [ponto({ data: '2026-06-01' }), ponto({ data: '2026-06-02', resolvidos: 3 })]
    expect(temMovimento(days)).toBe(true)
  })

  it('detecta movimento em cada uma das 5 séries', () => {
    expect(temMovimento([ponto({ novos: 1 })])).toBe(true)
    expect(temMovimento([ponto({ emAndamento: 1 })])).toBe(true)
    expect(temMovimento([ponto({ resolvidos: 1 })])).toBe(true)
    expect(temMovimento([ponto({ cancelados: 1 })])).toBe(true)
    expect(temMovimento([ponto({ emAberto: 1 })])).toBe(true)
  })
})

describe('isMovimentacaoEmpty', () => {
  it('não é empty enquanto carregando, mesmo sem dias', () => {
    expect(isMovimentacaoEmpty([], true, false)).toBe(false)
  })

  it('não é empty em erro, mesmo sem dias', () => {
    expect(isMovimentacaoEmpty([], false, true)).toBe(false)
  })

  it('é empty quando não há dias retornados', () => {
    expect(isMovimentacaoEmpty([], false, false)).toBe(true)
  })

  it('é empty quando há dias mas todas as séries somam zero (honesto, não quebrado)', () => {
    const days = [ponto({ data: '2026-06-01' }), ponto({ data: '2026-06-02' })]
    expect(isMovimentacaoEmpty(days, false, false)).toBe(true)
  })

  it('não é empty quando há movimentação real', () => {
    const days = [ponto({ data: '2026-06-01', novos: 2 })]
    expect(isMovimentacaoEmpty(days, false, false)).toBe(false)
  })
})
