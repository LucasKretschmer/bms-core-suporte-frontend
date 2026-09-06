import { describe, expect, it } from 'vitest'
import {
  dataCurta,
  dataPorExtenso,
  diaLocalSaoPaulo,
  ehDiaPassado,
  faixaAceitaDeFeriado,
  somarAnos,
} from './localDay'

/**
 * O dia local de São Paulo — a régua do aviso de retroatividade (DD-2) e da faixa de
 * ±10 anos da importação.
 */
describe('localDay — dia civil em America/Sao_Paulo', () => {
  it('usa o fuso de SP, não o relógio da máquina', () => {
    // 2026-09-07T02:00Z é 06/09 às 23:00 em São Paulo (UTC−3). Um `toISOString()` ou um
    // `format()` do date-fns em runner UTC diriam "2026-09-07" — um dia a mais.
    expect(diaLocalSaoPaulo(new Date('2026-09-07T02:00:00Z'))).toBe('2026-09-06')
    // E a virada acontece às 03:00Z, não à meia-noite UTC.
    expect(diaLocalSaoPaulo(new Date('2026-09-07T03:00:00Z'))).toBe('2026-09-07')
  })

  it('devolve sempre AAAA-MM-DD com dois dígitos', () => {
    expect(diaLocalSaoPaulo(new Date('2026-01-05T15:00:00Z'))).toBe('2026-01-05')
  })

  it('ehDiaPassado: ontem sim, hoje NÃO, amanhã não', () => {
    const hoje = '2026-09-06'
    expect(ehDiaPassado('2026-09-05', hoje)).toBe(true)
    expect(ehDiaPassado('2026-09-06', hoje)).toBe(false)
    expect(ehDiaPassado('2026-09-07', hoje)).toBe(false)
  })

  it('ehDiaPassado ignora texto que não é data civil', () => {
    expect(ehDiaPassado('06/09/2026', '2026-09-06')).toBe(false)
    expect(ehDiaPassado('', '2026-09-06')).toBe(false)
  })

  it('faixa aceita é hoje ±10 anos — o mesmo do HolidayService', () => {
    expect(faixaAceitaDeFeriado('2026-09-06')).toEqual({
      minimo: '2016-09-06',
      maximo: '2036-09-06',
    })
    expect(somarAnos('2026-02-29', -10)).toBe('2016-02-29')
  })

  it('dataPorExtenso é o que torna a ambiguidade DD/MM × MM/DD visível', () => {
    expect(dataPorExtenso('2026-04-03')).toBe('3 de abril de 2026')
    expect(dataPorExtenso('2026-03-04')).toBe('4 de março de 2026')
    expect(dataPorExtenso('2026-12-25')).toBe('25 de dezembro de 2026')
  })

  it('dataCurta formata para leitura brasileira sem passar por Date', () => {
    expect(dataCurta('2026-04-03')).toBe('03/04/2026')
    expect(dataCurta('texto')).toBe('texto')
  })
})
