import { describe, expect, it } from 'vitest'
import type { CalendarOptionDto } from '../types/supportPlan'
import {
  formatCalendario,
  formatHorasMes,
  formatHubspotValor,
  formatPrecoHoraExtra,
  formatSlaMeta,
  temVinculoFragil,
} from './planFormatters'

const calendarios: CalendarOptionDto[] = [
  { id: 1, nome: 'Comercial', padrao: true },
  { id: 2, nome: '24/7', padrao: false },
]

describe('formatHorasMes', () => {
  it('formata em pt-BR com sufixo de hora', () => {
    expect(formatHorasMes(40)).toBe('40 h')
    expect(formatHorasMes(7.5)).toBe('7,5 h')
  })

  it('devolve traço para null E para undefined (campo da rede)', () => {
    // AP-FRONTEND-028: `=== undefined` passaria nos dois mundos; só `== null` discrimina.
    // Sem o guard, `null` renderizaria "null h".
    expect(formatHorasMes(null)).toBe('—')
    expect(formatHorasMes(undefined)).toBe('—')
  })
})

describe('formatPrecoHoraExtra', () => {
  it('formata na moeda do plano', () => {
    expect(formatPrecoHoraExtra(250.5, 'BRL')).toContain('250,50')
    expect(formatPrecoHoraExtra(250.5, 'USD')).toContain('250,50')
  })

  it('devolve traço para null explícito', () => {
    expect(formatPrecoHoraExtra(null, 'BRL')).toBe('—')
  })

  it('não quebra a tela com código de moeda inválido — degrada para valor + código', () => {
    // `Intl.NumberFormat` lança RangeError para código fora do ISO 4217; a coluna toda
    // deixaria de renderizar por causa de uma linha.
    expect(formatPrecoHoraExtra(10, 'REAL')).toBe('10,00 REAL')
  })
})

describe('formatSlaMeta — três estados, não dois', () => {
  it('isento', () => {
    expect(formatSlaMeta({ slaIsento: true, slaPrimeiroAtendimentoMinutos: null })).toBe('Isento')
  })

  it('sem meta própria herda o padrão do calendário', () => {
    expect(formatSlaMeta({ slaIsento: false, slaPrimeiroAtendimentoMinutos: null })).toBe(
      'Padrão do calendário',
    )
  })

  it('meta própria em minutos, singular e plural', () => {
    expect(formatSlaMeta({ slaIsento: false, slaPrimeiroAtendimentoMinutos: 20 })).toBe('20 minutos')
    expect(formatSlaMeta({ slaIsento: false, slaPrimeiroAtendimentoMinutos: 1 })).toBe('1 minuto')
  })

  it('isento vence a meta, se as duas chegarem (estado que o CHECK proíbe)', () => {
    // O banco impede (`ck_suporte_supportplans_slaisento`), mas se o dado chegar assim a
    // tela não pode exibir uma meta que o cálculo ignora.
    expect(formatSlaMeta({ slaIsento: true, slaPrimeiroAtendimentoMinutos: 20 })).toBe('Isento')
  })
})

describe('formatCalendario', () => {
  it('null é o calendário padrão', () => {
    expect(formatCalendario(null, calendarios)).toBe('Calendário padrão')
    expect(formatCalendario(undefined, calendarios)).toBe('Calendário padrão')
  })

  it('resolve o nome pelo id', () => {
    expect(formatCalendario(2, calendarios)).toBe('24/7')
  })

  it('id desconhecido vira "#id" — não mente "é o padrão" nem fica em branco', () => {
    // Acontece enquanto BE-F2F3 não responde: há vínculo, o nome é que não se conhece.
    expect(formatCalendario(99, calendarios)).toBe('#99')
    expect(formatCalendario(2, [])).toBe('#2')
  })
})

describe('formatHubspotValor', () => {
  it('traço para null, undefined e string só de espaços', () => {
    expect(formatHubspotValor(null)).toBe('—')
    expect(formatHubspotValor(undefined)).toBe('—')
    expect(formatHubspotValor('   ')).toBe('—')
  })

  it('devolve o valor quando preenchido', () => {
    expect(formatHubspotValor('plano_pro')).toBe('plano_pro')
  })
})

describe('temVinculoFragil — R-1', () => {
  it('é verdadeiro sem identificador E com clientes vinculados', () => {
    expect(temVinculoFragil({ hubspotValor: null, clientesVinculados: 3 })).toBe(true)
    expect(temVinculoFragil({ hubspotValor: '  ', clientesVinculados: 1 })).toBe(true)
  })

  it('é falso com identificador preenchido, mesmo com clientes', () => {
    expect(temVinculoFragil({ hubspotValor: 'plano_pro', clientesVinculados: 9 })).toBe(false)
  })

  it('é falso sem clientes vinculados — renomear não quebra nada', () => {
    expect(temVinculoFragil({ hubspotValor: null, clientesVinculados: 0 })).toBe(false)
  })
})
