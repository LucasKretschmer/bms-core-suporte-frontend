import { describe, expect, it } from 'vitest'
import {
  asAutoStop,
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
    expect(resolveRule([], 'autoStopOnReply')).toEqual({ value: 'prompt', ruleId: null })
  })
})

describe('coerções de valor', () => {
  it('asBool só é true para true literal', () => {
    expect(asBool(true)).toBe(true)
    expect(asBool(false)).toBe(false)
    expect(asBool('true')).toBe(false)
    expect(asBool(1)).toBe(false)
  })

  it('asAutoStop normaliza valores inválidos para prompt', () => {
    expect(asAutoStop('auto')).toBe('auto')
    expect(asAutoStop('off')).toBe('off')
    expect(asAutoStop('prompt')).toBe('prompt')
    expect(asAutoStop('xpto')).toBe('prompt')
    expect(asAutoStop(true)).toBe('prompt')
  })

  it('asMinutes retorna número ou default', () => {
    expect(asMinutes(15)).toBe(15)
    expect(asMinutes('15')).toBe(5)
    expect(asMinutes(true)).toBe(5)
  })
})
