/**
 * 132/F4a — o plano efetivo de EXIBIÇÃO (`base + crédito`) e o formato compacto de D21.
 *
 * O que cada asserção existe para deixar VERMELHA (`rules/tests.md` § Prova de detecção):
 *
 *  1. trocar `== null` por `=== undefined` em `derivarPlanoEfetivo` → o caso `null` **explícito**
 *     cai (e só ele: por isso os dois casos de ausência são obrigatórios, AP-FRONTEND-028);
 *  2. um `?? 0` no lugar dos ramos → `creditoConhecido` deixa de distinguir "não sei" de
 *     "não há", e o caso do `0` cai;
 *  3. `!!creditoHoras` no lugar de `> 0` → `temCredito` viraria `false` para `0` **e**
 *     `true` para qualquer coisa truthy; o caso do `0` já pega, o do negativo confirma;
 *  4. usar `item.qtdePlanoEfetivoHoras` como fonte do número → o caso do default `0m` do C#
 *     cai imprimindo `0`;
 *  5. `formatHorasCompacto` reimplementado com `Math.floor` ou com `${h}h` cru → os literais
 *     `'2h 45m'` e `'15h'` (escritos à mão, do exemplo do usuário) caem.
 */

import { describe, expect, it, vi, afterEach } from 'vitest'
import { derivarPlanoEfetivo, formatHorasCompacto } from './planoEfetivo'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('derivarPlanoEfetivo — os três ramos de creditoHoras', () => {
  it('chave AUSENTE: crédito 0, não conhecido, efetivo = base (a tela de hoje)', () => {
    const r = derivarPlanoEfetivo({ clientId: 1, qtdePlanoHoras: 15 })

    expect(r).toEqual({
      baseHoras: 15,
      creditoHoras: 0,
      efetivoHoras: 15,
      temCredito: false,
      creditoConhecido: false,
    })
  })

  it('🔴 `null` EXPLÍCITO: idêntico à chave ausente — é o caso que `=== undefined` perde', () => {
    const r = derivarPlanoEfetivo({ clientId: 1, qtdePlanoHoras: 15, creditoHoras: null })

    expect(r.creditoHoras).toBe(0)
    expect(r.creditoConhecido).toBe(false)
    expect(r.temCredito).toBe(false)
    expect(r.efetivoHoras).toBe(15)
  })

  it('🔴 `0`: o backend RESPONDEU "não há crédito" — conhecido, sem crédito, efetivo = base', () => {
    const r = derivarPlanoEfetivo({ clientId: 1, qtdePlanoHoras: 15, creditoHoras: 0 })

    // O par (conhecido=true, temCredito=false) é o ÚNICO discriminador entre este caso e o de
    // cima: um `?? 0` os colapsaria e a tela ficaria igual nos dois — o que é correto na tela e
    // errado no dado (o export precisa distinguir "vazio" de "0", §3.5 da análise).
    expect(r.creditoConhecido).toBe(true)
    expect(r.temCredito).toBe(false)
    expect(r.creditoHoras).toBe(0)
    expect(r.efetivoHoras).toBe(15)
  })

  it('🔴 `> 0`: soma no efetivo — os números do usuário (15 + 2 = 17)', () => {
    const r = derivarPlanoEfetivo({ clientId: 1, qtdePlanoHoras: 15, creditoHoras: 2 })

    expect(r.efetivoHoras).toBe(17)
    expect(r.temCredito).toBe(true)
    expect(r.creditoConhecido).toBe(true)
  })

  it('os três ramos NÃO produzem o mesmo objeto (cardinalidade assimétrica de propósito)', () => {
    // Ausente, 0 e 2 na MESMA execução: se o predicado for invertido, algum destes três
    // deixa de bater. Comparar dois casos simétricos passaria com a inversão.
    const ausente = derivarPlanoEfetivo({ qtdePlanoHoras: 15 })
    const zero = derivarPlanoEfetivo({ qtdePlanoHoras: 15, creditoHoras: 0 })
    const dois = derivarPlanoEfetivo({ qtdePlanoHoras: 15, creditoHoras: 2 })

    expect(new Set([ausente.creditoConhecido, zero.creditoConhecido])).toEqual(
      new Set([false, true]),
    )
    expect([ausente.efetivoHoras, zero.efetivoHoras, dois.efetivoHoras]).toEqual([15, 15, 17])
  })
})

describe('derivarPlanoEfetivo — dados impossíveis não viram desconto nem NaN', () => {
  it('crédito NEGATIVO é neutralizado, mas continua CONHECIDO (o backend respondeu)', () => {
    const r = derivarPlanoEfetivo({ qtdePlanoHoras: 15, creditoHoras: -3 })

    // Nunca `efetivoHoras: 12`: crédito não é desconto. E `creditoConhecido` fica `true`
    // porque o servidor respondeu — confundi-lo com ausência esconderia o dado ruim.
    expect(r.creditoHoras).toBe(0)
    expect(r.efetivoHoras).toBe(15)
    expect(r.temCredito).toBe(false)
    expect(r.creditoConhecido).toBe(true)
  })

  it('`NaN` cai no ramo "não sei", nunca propaga para o efetivo', () => {
    const r = derivarPlanoEfetivo({ qtdePlanoHoras: 15, creditoHoras: Number.NaN })

    expect(Number.isNaN(r.efetivoHoras)).toBe(false)
    expect(r.efetivoHoras).toBe(15)
    expect(r.creditoConhecido).toBe(false)
  })

  it('crédito fracionário soma exato o suficiente para a granularidade do banco', () => {
    const r = derivarPlanoEfetivo({ qtdePlanoHoras: 15, creditoHoras: 2.5 })

    expect(r.efetivoHoras).toBeCloseTo(17.5, 4)
    expect(r.temCredito).toBe(true)
  })
})

describe('derivarPlanoEfetivo — qtdePlanoEfetivoHoras só DENUNCIA, nunca decide', () => {
  it('🔴 default `0m` do C#: o efetivo continua 17, nunca 0', () => {
    // A armadilha real (`ReportsDtos.cs:283`): o construtor posicional tem `= 0m`, então um
    // caminho que não passe o aditivo manda `0`. Ler o campo cru imprimiria "0h" como plano
    // efetivo NUMA TELA DE FATURA.
    const r = derivarPlanoEfetivo({
      clientId: 42,
      qtdePlanoHoras: 15,
      creditoHoras: 2,
      qtdePlanoEfetivoHoras: 0,
    })

    expect(r.efetivoHoras).toBe(17)
  })

  it('divergência acima da tolerância é denunciada em DEV, e a função prossegue', () => {
    const erro = vi.spyOn(console, 'error').mockImplementation(() => {})

    const r = derivarPlanoEfetivo({
      clientId: 42,
      qtdePlanoHoras: 15,
      creditoHoras: 2,
      qtdePlanoEfetivoHoras: 99,
    })

    expect(r.efetivoHoras).toBe(17)
    // Espião com REGISTRO, não sentinela que lança: o call site é "best-effort" e um `throw`
    // aqui seria engolido por qualquer `try` acima (`rules/tests.md` § Sentinela).
    expect(erro).toHaveBeenCalledTimes(1)
    expect(erro.mock.calls[0]?.[0]).toContain('42')
  })

  it('concordância NÃO denuncia (companheira positiva do assert de cima)', () => {
    const erro = vi.spyOn(console, 'error').mockImplementation(() => {})

    derivarPlanoEfetivo({
      clientId: 42,
      qtdePlanoHoras: 15,
      creditoHoras: 2,
      qtdePlanoEfetivoHoras: 17,
    })

    // Sem esta companheira, "não denuncia" passaria com um `console.error` que nunca é
    // alcançado — prova por ausência exige que o ponto observado seja alcançável nos dois casos
    // (o assert de cima prova que é).
    expect(erro).not.toHaveBeenCalled()
  })

  it('ruído de serialização abaixo de 1e-4 NÃO é denunciado', () => {
    const erro = vi.spyOn(console, 'error').mockImplementation(() => {})

    derivarPlanoEfetivo({
      qtdePlanoHoras: 15,
      creditoHoras: 2,
      qtdePlanoEfetivoHoras: 17.00001,
    })

    expect(erro).not.toHaveBeenCalled()
  })
})

describe('formatHorasCompacto — D21, e só nesta coluna', () => {
  it('omite os minutos quando são ZERO: 15 → "15h" (o layout do usuário)', () => {
    // Literal escrito à mão, do `prd.md` §5.1. `formatHours(15)` devolve "15h 0m" — é essa
    // diferença que a D21 existe para resolver.
    expect(formatHorasCompacto(15)).toBe('15h')
    expect(formatHorasCompacto(2)).toBe('2h')
    expect(formatHorasCompacto(0)).toBe('0h')
  })

  it('MANTÉM os minutos quando existem: 2,75 → "2h 45m"', () => {
    expect(formatHorasCompacto(2.75)).toBe('2h 45m')
    expect(formatHorasCompacto(14.25)).toBe('14h 15m')
    expect(formatHorasCompacto(2.5)).toBe('2h 30m')
  })

  it('não confunde "10m" com o sufixo removido (o corte é ` 0m`, não "0m")', () => {
    // `formatHours(2.1666…)` = "2h 10m". Um `replace('0m','')` cortaria o "0" do "10m" e
    // devolveria "2h 1m" — hora de fatura errada por um bug de string.
    expect(formatHorasCompacto(2 + 10 / 60)).toBe('2h 10m')
    expect(formatHorasCompacto(1 + 20 / 60)).toBe('1h 20m')
  })

  it('arredonda igual a formatHours (é delegação, não segunda implementação)', () => {
    // 2h44m do PRD = 2,7333h. `formatHours` arredonda por segundo.
    expect(formatHorasCompacto(2.7333333)).toBe('2h 44m')
  })
})
