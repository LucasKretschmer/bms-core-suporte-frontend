/**
 * 123/FE-PER (D-2) — regra de default do período.
 *
 * O que deixa cada asserção VERMELHA está escrito ao lado de cada caso. O eixo central:
 * o default do painel tem de reproduzir EXATAMENTE o do backend
 * (`FusoSaoPaulo.Resolver`: dia 1 → último dia do mês local), senão a tela troca uma
 * divergência de janela por outra.
 */

import { describe, expect, it } from 'vitest'
import { defaultCurrentMonthFullPeriod } from './defaultPeriod'
import { resolverPeriodoPadrao } from './periodoPadrao'

/**
 * 123/FE-FIX3 (ressalva `F-3`) — `primeiroDiaDoMesAtual`/`ultimoDiaDoMesAtual` deixaram
 * de existir: eram uma segunda implementação de `defaultCurrentMonthFullPeriod`, na mesma
 * pasta. Os casos de fronteira que os exercitavam **não foram apagados** — passaram a
 * exercitar a API pública que sobrou (`resolverPeriodoPadrao` com as duas pontas em
 * branco), que é por onde a tela chega nesse cálculo. Assim eles continuam vermelhos
 * pelos mesmos motivos de antes, agora medindo a implementação consolidada.
 */
const mesInteiroDe = (referencia: Date): { from: string; to: string } =>
  resolverPeriodoPadrao({ from: null, to: null }, referencia)

/** Relógio fixo: 15/09/2026, meio-dia local. Todos os literais abaixo são escritos à mão. */
const AGORA = new Date(2026, 8, 15, 12, 0, 0)

describe('bordas do mês atual', () => {
  it('primeiro dia é o dia 1 do mês de referência', () => {
    // Vermelho se alguém trocar startOfMonth por "hoje" ou por subDays(30).
    expect(mesInteiroDe(AGORA).from).toBe('2026-09-01')
  })

  it('último dia é o último dia REAL do mês (não 30 fixo, não o dia seguinte)', () => {
    // Vermelho com aritmética manual de 30 dias, ou com `addMonths(-1)`.
    expect(mesInteiroDe(AGORA).to).toBe('2026-09-30')
  })

  it('meses de 31 dias, de 28 e fevereiro bissexto', () => {
    // Vermelho se o cálculo de fim virar constante ou ignorar ano bissexto.
    expect(mesInteiroDe(new Date(2026, 0, 5)).to).toBe('2026-01-31')
    expect(mesInteiroDe(new Date(2026, 1, 5)).to).toBe('2026-02-28')
    expect(mesInteiroDe(new Date(2028, 1, 5)).to).toBe('2028-02-29')
  })

  it('vira o ano sem escorregar de mês', () => {
    expect(mesInteiroDe(new Date(2026, 11, 31, 23, 30))).toEqual({
      from: '2026-12-01',
      to: '2026-12-31',
    })
  })

  it('usa o dia CIVIL local, não o UTC (23:30 de 31/12 não vira 01/01)', () => {
    // Vermelho com `toISOString().slice(0,10)`, que é o off-by-one clássico em SP.
    // Em UTC-3 este instante é 2027-01-01T02:30Z.
    expect(mesInteiroDe(new Date(2026, 11, 31, 23, 30)).to).not.toBe('2027-01-31')
    expect(mesInteiroDe(new Date(2026, 11, 31, 23, 30)).to).toBe('2026-12-31')
  })
})

describe('123/FE-FIX3 (F-3) — o mês atual vem de defaultCurrentMonthFullPeriod, não de uma segunda cópia', () => {
  it('delega: com as duas pontas em branco o resultado É o de defaultCurrentMonthFullPeriod', () => {
    // Teste de DELEGAÇÃO. Sozinho seria tautológico se a função delegada estivesse
    // errada — por isso o irmão com LITERAL escrito à mão vem logo abaixo
    // (`rules/tests.md` § "expectativa derivada da própria resposta é tautologia").
    for (const referencia of [AGORA, new Date(2026, 1, 3), new Date(2028, 1, 29, 23, 59)]) {
      expect(resolverPeriodoPadrao({ from: null, to: null }, referencia)).toEqual(
        defaultCurrentMonthFullPeriod(referencia),
      )
    }
  })

  it('o irmão LITERAL da delegação: os valores são estes, escritos à mão', () => {
    expect(defaultCurrentMonthFullPeriod(AGORA)).toEqual({ from: '2026-09-01', to: '2026-09-30' })
    expect(defaultCurrentMonthFullPeriod(new Date(2026, 1, 3))).toEqual({
      from: '2026-02-01',
      to: '2026-02-28',
    })
    expect(defaultCurrentMonthFullPeriod(new Date(2028, 1, 29, 23, 59))).toEqual({
      from: '2028-02-01',
      to: '2028-02-29',
    })
  })

  it('as duas pontas do default saem do MESMO instante de referência', () => {
    // Vermelho se `resolverPeriodoPadrao` voltar a chamar dois helpers separados: na
    // virada da meia-noite duas chamadas podem cair em meses diferentes. Aqui o último
    // instante de um mês tem de produzir as duas pontas DAQUELE mês.
    const ultimoInstante = new Date(2026, 6, 31, 23, 59, 59, 999)
    expect(resolverPeriodoPadrao({ from: null, to: null }, ultimoInstante)).toEqual({
      from: '2026-07-01',
      to: '2026-07-31',
    })
  })
})

describe('resolverPeriodoPadrao — as duas pontas, uma a uma', () => {
  it('as duas em branco viram o mês inteiro', () => {
    expect(resolverPeriodoPadrao({ from: null, to: null }, AGORA)).toEqual({
      from: '2026-09-01',
      to: '2026-09-30',
    })
  })

  it('datas informadas passam INTACTAS (o default não sequestra o filtro do usuário)', () => {
    // Vermelho se alguém "normalizar" o período para o mês da data informada.
    expect(
      resolverPeriodoPadrao({ from: '2026-07-10', to: '2026-08-04' }, AGORA),
    ).toEqual({ from: '2026-07-10', to: '2026-08-04' })
  })

  it('só o início em branco fecha SÓ o início (a outra ponta continua a do usuário)', () => {
    // Vermelho se a resolução for "tudo ou nada" — que é o erro que faria a tela mentir
    // sobre a janela quando o usuário limpa um campo só.
    expect(resolverPeriodoPadrao({ from: null, to: '2026-07-31' }, AGORA)).toEqual({
      from: '2026-09-01',
      to: '2026-07-31',
    })
  })

  it('só o fim em branco fecha SÓ o fim', () => {
    expect(resolverPeriodoPadrao({ from: '2026-07-01', to: null }, AGORA)).toEqual({
      from: '2026-07-01',
      to: '2026-09-30',
    })
  })

  it('nunca devolve null em nenhuma ponta — é isso que impede o wire de cair no default do backend', () => {
    const casos = [
      { from: null, to: null },
      { from: null, to: '2026-07-31' },
      { from: '2026-07-01', to: null },
      { from: '2026-07-01', to: '2026-07-31' },
    ]
    for (const caso of casos) {
      const r = resolverPeriodoPadrao(caso, AGORA)
      expect(typeof r.from).toBe('string')
      expect(typeof r.to).toBe('string')
    }
    // Controle positivo: o conjunto de casos é o das 4 combinações possíveis das 2 pontas.
    expect(casos).toHaveLength(4)
  })

  it('sem `agora`, usa o relógio real — e o resultado é o mês de hoje', () => {
    // Prova que o parâmetro é OPCIONAL de verdade (call sites de produção não o passam).
    const hoje = new Date()
    expect(resolverPeriodoPadrao({ from: null, to: null })).toEqual(
      defaultCurrentMonthFullPeriod(hoje),
    )
    // Companheira não tautológica: a forma do valor é verificada contra literal.
    const r = resolverPeriodoPadrao({ from: null, to: null })
    expect(r.from).toMatch(/^\d{4}-\d{2}-01$/)
    expect(r.to).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
