import { describe, expect, it } from 'vitest'
import {
  isStatusBucket,
  formatStatusDisplay,
  formatBucketLabel,
  STATUS_BUCKET_OPTIONS,
} from './statusBucket'

describe('statusBucket utils', () => {
  describe('isStatusBucket', () => {
    it('reconhece buckets conhecidos', () => {
      expect(isStatusBucket('emandamento')).toBe(true)
      expect(isStatusBucket('novos')).toBe(true)
      expect(isStatusBucket('cancelados')).toBe(true)
    })

    it('rejeita valores desconhecidos', () => {
      expect(isStatusBucket('inexistente')).toBe(false)
      expect(isStatusBucket('')).toBe(false)
    })
  })

  describe('formatStatusDisplay', () => {
    it('prefere o statusLabel congelado quando presente', () => {
      expect(formatStatusDisplay('emandamento', 'Em atendimento (BR)')).toBe('Em atendimento (BR)')
    })

    it('usa o rótulo PT-BR do bucket quando não há statusLabel', () => {
      expect(formatStatusDisplay('emandamento', null)).toBe('Em atendimento')
      expect(formatStatusDisplay('novos', '')).toBe('Novos')
      expect(formatStatusDisplay('fechado', '   ')).toBe('Resolvido')
    })

    it('retorna o bucket cru como fallback para valor desconhecido sem label', () => {
      expect(formatStatusDisplay('desconhecido', null)).toBe('desconhecido')
    })
  })

  describe('formatBucketLabel', () => {
    it('mapeia bucket conhecido para rótulo PT-BR', () => {
      expect(formatBucketLabel('cancelado')).toBe('Cancelado')
      expect(formatBucketLabel('resolvidos')).toBe('Resolvidos')
    })

    it('devolve o valor cru para bucket desconhecido', () => {
      expect(formatBucketLabel('xpto')).toBe('xpto')
    })
  })

  describe('STATUS_BUCKET_OPTIONS', () => {
    it('cobre as 7 famílias de bucket (estoque + fluxo)', () => {
      expect(STATUS_BUCKET_OPTIONS).toHaveLength(7)
      const values = STATUS_BUCKET_OPTIONS.map((o) => o.value)
      expect(values).toEqual([
        'aberto',
        'emandamento',
        'fechado',
        'cancelado',
        'novos',
        'resolvidos',
        'cancelados',
      ])
    })
  })
})
