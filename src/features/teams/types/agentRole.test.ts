import { describe, expect, it } from 'vitest'
import {
  AGENT_PROFILE_OPTIONS,
  ROLE_CODE,
  profileToRoleCode,
  roleNameToProfile,
} from './agentRole'

describe('agentRole — de-para perfil ↔ role', () => {
  describe('roleNameToProfile', () => {
    it('ATENDENTE → "atendente"', () => {
      expect(roleNameToProfile('ATENDENTE')).toBe('atendente')
    })

    it('GERENTE → "gestor"', () => {
      expect(roleNameToProfile('GERENTE')).toBe('gestor')
    })

    it('COORDENADOR → "gestor"', () => {
      expect(roleNameToProfile('COORDENADOR')).toBe('gestor')
    })

    it('ADMIN → "gestor"', () => {
      expect(roleNameToProfile('ADMIN')).toBe('gestor')
    })

    it('é case-insensitive (atendente minúsculo → "atendente")', () => {
      expect(roleNameToProfile('atendente')).toBe('atendente')
    })

    it('valor desconhecido → "gestor" (fallback seguro)', () => {
      expect(roleNameToProfile('QUALQUER')).toBe('gestor')
    })
  })

  describe('profileToRoleCode', () => {
    it('"atendente" → 1 (Atendente)', () => {
      expect(profileToRoleCode('atendente')).toBe(ROLE_CODE.Atendente)
      expect(profileToRoleCode('atendente')).toBe(1)
    })

    it('"gestor" → 3 (Gerente)', () => {
      expect(profileToRoleCode('gestor')).toBe(ROLE_CODE.Gerente)
      expect(profileToRoleCode('gestor')).toBe(3)
    })
  })

  describe('AGENT_PROFILE_OPTIONS', () => {
    it('expõe exatamente atendente e gestor', () => {
      expect(AGENT_PROFILE_OPTIONS.map((o) => o.value)).toEqual(['atendente', 'gestor'])
    })
  })
})
