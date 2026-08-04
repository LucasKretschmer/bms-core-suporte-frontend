import { describe, expect, it } from 'vitest'
import {
  RULE_DEFAULTS,
  TEAM_BOOL_KEYS,
  asBool,
  asMinutes,
  resolveRule,
  type BusinessRuleDto,
} from './businessRule'

function makeRule(over: Partial<BusinessRuleDto>): BusinessRuleDto {
  return {
    id: 1,
    teamId: null,
    chave: 'k',
    valor: true,
    criadoEm: '',
    atualizadoEm: '',
    ...over,
  }
}

describe('resolveRule', () => {
  it('retorna valor e ruleId quando a regra existe', () => {
    const rules = [makeRule({ id: 1, chave: 'allowEditTimes', valor: true })]
    expect(resolveRule(rules, 'allowEditTimes')).toEqual({ value: true, ruleId: 1 })
  })

  it('aplica default e ruleId null quando ausente', () => {
    expect(resolveRule([], 'allowEditTimes')).toEqual({ value: false, ruleId: null })
    expect(resolveRule([], 'singleActiveTimer')).toEqual({ value: true, ruleId: null })
    expect(resolveRule([], 'idleAlertMinutes')).toEqual({ value: 5, ruleId: null })
  })
})

/**
 * Trava de identidade (AP-QA-019): o conjunto de chaves que o painel edita é
 * verificado pelos NOMES literais, não pela quantidade — cardinalidade passa
 * quando uma chave entra e outra sai. `autoStopOnReply` foi revogada em
 * 2026-08-04 (121/D11) e não pode voltar por acidente.
 */
describe('conjunto de chaves editáveis pelo painel', () => {
  it('RULE_DEFAULTS tem exatamente as 7 chaves vivas', () => {
    expect(Object.keys(RULE_DEFAULTS).sort()).toEqual([
      'allowCrossTeam',
      'allowEditTimes',
      'idleAlertMinutes',
      'notifyNewInQueue',
      'notifyStatusChange',
      'showProjectActivities',
      'singleActiveTimer',
    ])
  })

  it('não conhece a regra revogada autoStopOnReply', () => {
    expect(Object.keys(RULE_DEFAULTS)).not.toContain('autoStopOnReply')
    expect(TEAM_BOOL_KEYS).not.toContain('autoStopOnReply')
    // Companheira positiva: o mecanismo continua vivo para as chaves que ficaram.
    expect(TEAM_BOOL_KEYS).toContain('singleActiveTimer')
    expect(TEAM_BOOL_KEYS).toHaveLength(6)
  })
})

describe('coerções de valor', () => {
  it('asBool só é true para true literal', () => {
    expect(asBool(true)).toBe(true)
    expect(asBool(false)).toBe(false)
    expect(asBool('true')).toBe(false)
    expect(asBool(1)).toBe(false)
  })

  it('asMinutes retorna número ou default', () => {
    expect(asMinutes(15)).toBe(15)
    expect(asMinutes('15')).toBe(5)
    expect(asMinutes(true)).toBe(5)
  })
})
