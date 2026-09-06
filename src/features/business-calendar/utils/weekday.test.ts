import { describe, expect, it } from 'vitest'
import {
  DIAS_DA_SEMANA,
  DOMINGO,
  SABADO,
  diaSemanaDaData,
  ehDiaSemana,
  nomeDoDia,
} from './weekday'

/**
 * R-6 — **`0 = domingo`, e nunca se traduz.**
 *
 * O que faz cada assert daqui ficar vermelho:
 * - um `+1`/`-1`/`% 7` em qualquer ponto da conversão;
 * - a lista reordenada para "segunda-feira primeiro" (o reflexo natural de quem monta
 *   uma grade semanal em pt-BR);
 * - `diaSemanaDaData` voltando a usar `new Date(iso)`, que é meia-noite **UTC** e
 *   devolve o dia anterior em `America/Sao_Paulo`.
 */
describe('weekday — a convenção 0 = domingo (R-6)', () => {
  it('a tabela tem os sete dias, na ordem do VALOR, com os nomes literais', () => {
    expect(DIAS_DA_SEMANA.map((d) => [d.valor, d.nome])).toEqual([
      [0, 'Domingo'],
      [1, 'Segunda-feira'],
      [2, 'Terça-feira'],
      [3, 'Quarta-feira'],
      [4, 'Quinta-feira'],
      [5, 'Sexta-feira'],
      [6, 'Sábado'],
    ])
  })

  it('índice e valor coincidem em todas as posições', () => {
    DIAS_DA_SEMANA.forEach((dia, indice) => {
      expect(dia.valor).toBe(indice)
    })
  })

  it('DOMINGO é 0 e SABADO é 6', () => {
    expect(DOMINGO).toBe(0)
    expect(SABADO).toBe(6)
  })

  it('ancora o índice 0 num domingo REAL do calendário, via Date.getDay()', () => {
    // 2026-09-06 é domingo; 2026-09-07, segunda; 2026-09-12, sábado.
    expect(new Date(2026, 8, 6).getDay()).toBe(DOMINGO)
    expect(new Date(2026, 8, 12).getDay()).toBe(SABADO)
    expect(nomeDoDia(new Date(2026, 8, 6).getDay())).toBe('Domingo')
    expect(nomeDoDia(new Date(2026, 8, 7).getDay())).toBe('Segunda-feira')
  })

  it('diaSemanaDaData devolve o MESMO número do DayOfWeek do .NET', () => {
    expect(diaSemanaDaData('2026-09-06')).toBe(0)
    expect(diaSemanaDaData('2026-09-07')).toBe(1)
    expect(diaSemanaDaData('2026-09-12')).toBe(6)
  })

  it('diaSemanaDaData NÃO desloca o dia (o bug de `new Date(iso)` em UTC−3)', () => {
    // Com `new Date('2026-09-06')` (meia-noite UTC) e fuso negativo, getDay() daria
    // sábado (6). O parse por componentes locais mantém domingo (0).
    expect(diaSemanaDaData('2026-09-06')).not.toBe(6)
    expect(nomeDoDia(diaSemanaDaData('2026-09-06') as number)).toBe('Domingo')
  })

  it('recusa data inexistente e texto fora do formato', () => {
    expect(diaSemanaDaData('2026-02-31')).toBeNull()
    expect(diaSemanaDaData('06/09/2026')).toBeNull()
    expect(diaSemanaDaData('')).toBeNull()
  })

  it('ehDiaSemana aceita 0..6 e recusa o resto — inclusive 7 e -1', () => {
    expect([0, 1, 2, 3, 4, 5, 6].every(ehDiaSemana)).toBe(true)
    expect(ehDiaSemana(7)).toBe(false)
    expect(ehDiaSemana(-1)).toBe(false)
    expect(ehDiaSemana(1.5)).toBe(false)
  })

  it('valor fora da convenção NÃO vira domingo: o rótulo denuncia o problema', () => {
    // "não sei responder" nunca pode virar "respondi que é domingo".
    expect(nomeDoDia(7)).toContain('fora da convenção')
    expect(nomeDoDia(7)).not.toBe('Domingo')
  })
})
