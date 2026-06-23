import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../services/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn() },
}))

import { api } from '../../../services/api'
import {
  createBusinessRule,
  listBusinessRules,
  saveBusinessRule,
  updateBusinessRule,
} from './businessRulesService'
import type { BusinessRuleDto } from '../types/businessRule'

const rule: BusinessRuleDto = {
  id: 1,
  teamId: 5,
  chave: 'singleActiveTimer',
  valor: true,
  criadoEm: '2026-06-19T00:00:00Z',
  atualizadoEm: '2026-06-19T00:00:00Z',
}

describe('businessRulesService', () => {
  beforeEach(() => vi.clearAllMocks())

  describe('listBusinessRules', () => {
    it('sem teamId → GET sem params (globais)', async () => {
      vi.mocked(api.get).mockResolvedValueOnce({ data: { data: [] } })
      await listBusinessRules(null)
      expect(api.get).toHaveBeenCalledWith('/api/v1/business-rules', { params: undefined })
    })

    it('com teamId → GET com params { teamId }', async () => {
      vi.mocked(api.get).mockResolvedValueOnce({ data: { data: [rule] } })
      const result = await listBusinessRules(5)
      expect(api.get).toHaveBeenCalledWith('/api/v1/business-rules', { params: { teamId: 5 } })
      expect(result).toEqual([rule])
    })
  })

  describe('createBusinessRule', () => {
    it('faz POST com { teamId, chave, valor }', async () => {
      vi.mocked(api.post).mockResolvedValueOnce({ data: { data: rule } })
      await createBusinessRule({ teamId: 5, chave: 'singleActiveTimer', valor: true })
      expect(api.post).toHaveBeenCalledWith('/api/v1/business-rules', {
        teamId: 5,
        chave: 'singleActiveTimer',
        valor: true,
      })
    })
  })

  describe('updateBusinessRule', () => {
    it('faz PUT { valor } no id', async () => {
      vi.mocked(api.put).mockResolvedValueOnce({ data: { data: rule } })
      await updateBusinessRule(1, false)
      expect(api.put).toHaveBeenCalledWith('/api/v1/business-rules/1', { valor: false })
    })
  })

  describe('saveBusinessRule (upsert)', () => {
    it('com ruleId → PUT (update)', async () => {
      vi.mocked(api.put).mockResolvedValueOnce({ data: { data: rule } })
      await saveBusinessRule({ ruleId: 1, teamId: 5, chave: 'allowEditTimes', valor: true })
      expect(api.put).toHaveBeenCalledWith('/api/v1/business-rules/1', { valor: true })
      expect(api.post).not.toHaveBeenCalled()
    })

    it('sem ruleId → POST (create)', async () => {
      vi.mocked(api.post).mockResolvedValueOnce({ data: { data: rule } })
      await saveBusinessRule({ ruleId: null, teamId: 5, chave: 'allowEditTimes', valor: true })
      expect(api.post).toHaveBeenCalledWith('/api/v1/business-rules', {
        teamId: 5,
        chave: 'allowEditTimes',
        valor: true,
      })
      expect(api.put).not.toHaveBeenCalled()
    })

    it('global (teamId null) sem ruleId → POST com teamId null', async () => {
      vi.mocked(api.post).mockResolvedValueOnce({ data: { data: rule } })
      await saveBusinessRule({ ruleId: null, teamId: null, chave: 'idleAlertMinutes', valor: 10 })
      expect(api.post).toHaveBeenCalledWith('/api/v1/business-rules', {
        teamId: null,
        chave: 'idleAlertMinutes',
        valor: 10,
      })
    })
  })
})
