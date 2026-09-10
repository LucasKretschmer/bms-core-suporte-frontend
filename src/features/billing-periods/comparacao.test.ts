import { describe, expect, it } from 'vitest'
import {
  CAMPOS_COMPARADOS,
  campoEstaDivergente,
  camposDivergentesDesconhecidos,
  formatarCampoComparado,
  rotuloDeDivergencia,
} from './comparacao'
import { ROTULO_DO_CAMPO } from './competenciaTelaTextos'
import type { BillingPeriodComparisonItemDto } from './types/billingPeriod'

const VALORES = {
  planoBaseHoras: 15,
  creditoHoras: 2,
  planoEfetivoHoras: 17,
  horasUsadas: 2.75,
  horasRestantes: 14.25,
  horasAdicionais: 0,
  percentualPlano: 16.18,
  horasFaturaveis: 2.75,
  horasAnalise: 0,
}

function item(parcial: Partial<BillingPeriodComparisonItemDto>): BillingPeriodComparisonItemDto {
  return { clientId: 1, clienteNome: 'Acme', snapshot: VALORES, aoVivo: VALORES, ...parcial }
}

describe('CAMPOS_COMPARADOS — identidade do contrato §8.2', () => {
  it('são exatamente os nove campos, nominalmente', () => {
    // Cardinalidade passaria com um campo entrando e outro saindo. A lista é a MESMA que
    // gera as colunas da tabela — por isso identidade, e por isso uma só.
    expect([...CAMPOS_COMPARADOS]).toEqual([
      'planoBaseHoras',
      'creditoHoras',
      'planoEfetivoHoras',
      'horasUsadas',
      'horasRestantes',
      'horasAdicionais',
      'percentualPlano',
      'horasFaturaveis',
      'horasAnalise',
    ])
  })

  it('todo campo comparado tem rótulo em português', () => {
    for (const campo of CAMPOS_COMPARADOS) {
      expect(ROTULO_DO_CAMPO[campo], campo).toBeTruthy()
    }
  })
})

describe('formatarCampoComparado', () => {
  it('horas em "Xh Ym" e percentual com UMA casa — os literais do sistema', () => {
    expect(formatarCampoComparado('horasUsadas', VALORES)).toBe('2h 45m')
    expect(formatarCampoComparado('horasRestantes', VALORES)).toBe('14h 15m')
    expect(formatarCampoComparado('planoEfetivoHoras', VALORES)).toBe('17h 0m')
    // D21: o `% do Plano` mantém 1 casa, como o resto da app (16,18 → "16,2%").
    expect(formatarCampoComparado('percentualPlano', VALORES)).toBe('16,2%')
  })

  it('`null` EXPLÍCITO vira travessão — nunca "0h 0m", nunca "0,0%"', () => {
    // 🔴 `AP-FRONTEND-028`. Trocar `== null` por `=== undefined` deixa o caso `null` passar
    // e a célula afirma ZERO sobre um valor desconhecido — a mentira exata que o ramo
    // existe para impedir. O caso `undefined` sozinho não discriminaria.
    expect(formatarCampoComparado('horasUsadas', { horasUsadas: null })).toBe('—')
    expect(formatarCampoComparado('percentualPlano', { percentualPlano: null })).toBe('—')
    expect(formatarCampoComparado('horasUsadas', {})).toBe('—')
    expect(formatarCampoComparado('horasUsadas', null)).toBe('—')
  })

  it('ZERO declarado pelo servidor continua sendo zero', () => {
    // A companheira do caso acima: sem ela, um guard exagerado (`!valor`) transformaria
    // "0h 0m" — um número real e comum — em "não sei".
    expect(formatarCampoComparado('horasAdicionais', { horasAdicionais: 0 })).toBe('0h 0m')
    expect(formatarCampoComparado('percentualPlano', { percentualPlano: 0 })).toBe('0,0%')
  })
})

describe('campoEstaDivergente — quem decide é o servidor', () => {
  it('marca só o que veio em camposDivergentes', () => {
    const linha = item({ camposDivergentes: ['horasUsadas'] })
    expect(campoEstaDivergente(linha, 'horasUsadas')).toBe(true)
    // Cardinalidade assimétrica de propósito (1 marcado, 8 não): num par 1×1 a inversão do
    // predicado passaria.
    for (const campo of CAMPOS_COMPARADOS.filter((c) => c !== 'horasUsadas')) {
      expect(campoEstaDivergente(linha, campo), campo).toBe(false)
    }
  })

  it('camposDivergentes ausente/`null` não marca nada — "não sei" não é "divergiu"', () => {
    expect(campoEstaDivergente(item({ camposDivergentes: null }), 'horasUsadas')).toBe(false)
    expect(campoEstaDivergente(item({}), 'horasUsadas')).toBe(false)
  })

  it('valores DIFERENTES sem o aval do servidor NÃO são marcados', () => {
    // 🔴 Fica vermelho se alguém "melhorar" a tela comparando `snapshot.x !== aoVivo.x`:
    // seria uma segunda fonte de verdade sobre um veredito que já foi dado no servidor.
    const linha = item({
      snapshot: { ...VALORES, horasUsadas: 2.75 },
      aoVivo: { ...VALORES, horasUsadas: 9.5 },
      camposDivergentes: [],
    })
    expect(campoEstaDivergente(linha, 'horasUsadas')).toBe(false)
  })
})

describe('camposDivergentesDesconhecidos', () => {
  it('devolve os nomes que o painel não desenha — para não sumirem em silêncio', () => {
    const itens = [
      item({ camposDivergentes: ['horasUsadas', 'campoNovoDoServidor'] }),
      item({ clientId: 2, camposDivergentes: ['outroCampoNovo', 'horasUsadas'] }),
      item({ clientId: 3, camposDivergentes: null }),
    ]
    expect(camposDivergentesDesconhecidos(itens)).toEqual([
      'campoNovoDoServidor',
      'outroCampoNovo',
    ])
  })

  it('sem campo desconhecido, devolve lista vazia', () => {
    expect(camposDivergentesDesconhecidos([item({ camposDivergentes: ['creditoHoras'] })])).toEqual(
      [],
    )
  })
})

describe('rotuloDeDivergencia', () => {
  it('`null` vira travessão; `false` vira "Não"; `true` vira "Sim"', () => {
    // `AP-FRONTEND-028` literal: `null` virando "Não" afirmaria "não divergiu" sobre um
    // valor que o servidor não informou.
    expect(rotuloDeDivergencia(item({ temDivergencia: null }))).toBe('—')
    expect(rotuloDeDivergencia(item({}))).toBe('—')
    expect(rotuloDeDivergencia(item({ temDivergencia: false }))).toBe('Não')
    expect(rotuloDeDivergencia(item({ temDivergencia: true }))).toBe('Sim')
  })
})
