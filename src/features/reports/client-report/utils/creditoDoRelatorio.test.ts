/**
 * 132/F9 — testes do adaptador de crédito do Relatório do Cliente.
 *
 * O que **não** é testado aqui: a regra dos três ramos em si, que é de
 * `shared/utils/planoEfetivo.test.ts`. Aqui se prova o que este arquivo decide — **de qual
 * campo do DTO sai cada número** e **em que unidade ele é formatado** —, que é justamente o
 * que não tem sintoma: um erro de unidade imprime "0h 0m", que é plausível, e um erro de
 * campo imprime as horas usadas no lugar do crédito, que também é plausível.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ClientReportDto } from '../../shared/types/reports'
import {
  derivarCreditoDoRelatorio,
  entradaDoPlanoEfetivoDoRelatorio,
} from './creditoDoRelatorio'

/**
 * ⚠️ A restauração do espião vive AQUI, e não no fim de cada caso: um `mockRestore()` na
 * última linha do teste **não roda** quando uma asserção anterior falha, e o espião
 * sobrevive para o caso seguinte — `vi.spyOn` sobre um método já espionado devolve o MESMO
 * mock, com o contador acumulado. Descoberto ao medir a mutação M-F9-1: a contaminação
 * fazia um segundo caso falhar por motivo alheio ao defeito.
 */
afterEach(() => {
  vi.restoreAllMocks()
})

/**
 * Números todos DIFERENTES entre si de propósito: com valores iguais, ler o campo errado
 * devolveria o valor certo por coincidência e nenhuma asserção discriminaria.
 *  · `horasEfetivas: 15`         → plano BASE, em horas
 *  · `horasPlanoSegundos: 9900`  → horas USADAS (2h 45m), em segundos — nunca o plano
 *  · `creditoHoras: 2`           → o crédito, em horas
 */
function relatorio(overrides: Partial<ClientReportDto> = {}): ClientReportDto {
  return {
    client: {
      id: 7,
      hubspotCompanyId: 10,
      cnpj: null,
      razaoSocial: 'ACME LTDA',
      nomeFantasia: 'ACME',
      supportPlan: null,
      horasOverride: null,
      horasEfetivas: 15,
    },
    plano: null,
    competencia: '2026-08',
    totalApontamentos: 3,
    totalSegundos: 13500,
    horasPlanoSegundos: 9900,
    horasFaturadoSegundos: 3600,
    horasNaoFaturadoSegundos: 0,
    items: null,
    ...overrides,
  }
}

describe('derivarCreditoDoRelatorio — os três ramos chegam inteiros do planoEfetivo', () => {
  it('chave AUSENTE ⇒ não sei: temCredito e creditoConhecido falsos', () => {
    // `relatorio()` não traz `creditoHoras`: é o backend anterior à 132.
    const credito = derivarCreditoDoRelatorio(relatorio())

    expect(credito.temCredito).toBe(false)
    expect(credito.creditoConhecido).toBe(false)
    expect(credito.creditoHoras).toBe(0)
  })

  it('`null` EXPLÍCITO ⇒ idêntico ao ausente (guard `== null`, nunca `=== undefined`)', () => {
    const credito = derivarCreditoDoRelatorio(relatorio({ creditoHoras: null }))

    expect(credito.temCredito).toBe(false)
    expect(credito.creditoConhecido).toBe(false)
  })

  it('`0` ⇒ não há crédito, mas o backend RESPONDEU: creditoConhecido verdadeiro', () => {
    const credito = derivarCreditoDoRelatorio(
      relatorio({ creditoHoras: 0, horasPlanoEfetivas: 15 }),
    )

    expect(credito.temCredito).toBe(false)
    // O discriminador entre "não sei" e "não há" — os dois renderizam igual.
    expect(credito.creditoConhecido).toBe(true)
  })

  it('`> 0` ⇒ há crédito', () => {
    const credito = derivarCreditoDoRelatorio(
      relatorio({ creditoHoras: 2, horasPlanoEfetivas: 17 }),
    )

    expect(credito.temCredito).toBe(true)
    expect(credito.creditoHoras).toBe(2)
  })
})

describe('derivarCreditoDoRelatorio — a UNIDADE do texto (armadilha 1)', () => {
  it('2 horas de crédito imprimem "2h 0m" — nunca "0h 0m", que é o que formatSeconds daria', () => {
    const credito = derivarCreditoDoRelatorio(
      relatorio({ creditoHoras: 2, horasPlanoEfetivas: 17 }),
    )

    // Literal escrito à mão. Trocar `formatHours` por `formatSeconds` deixa isto vermelho —
    // e a negativa abaixo é o que impede o erro de passar como "número plausível".
    expect(credito.creditoTexto).toBe('2h 0m')
    expect(credito.creditoTexto).not.toBe('0h 0m')
  })

  it('crédito fracionário: 2,75 h ⇒ "2h 45m"', () => {
    const credito = derivarCreditoDoRelatorio(
      relatorio({ creditoHoras: 2.75, horasPlanoEfetivas: 17.75 }),
    )

    expect(credito.creditoTexto).toBe('2h 45m')
  })
})

describe('entradaDoPlanoEfetivoDoRelatorio — de qual campo sai cada número (armadilha 2)', () => {
  it('identidade LITERAL do objeto: a base é `client.horasEfetivas`, não `horasPlanoSegundos`', () => {
    const entrada = entradaDoPlanoEfetivoDoRelatorio(
      relatorio({ creditoHoras: 2, horasPlanoEfetivas: 17 }),
    )

    // `toEqual` (identidade das chaves), não `toMatchObject`: um campo a mais aqui é um
    // campo que `derivarPlanoEfetivo` passaria a ler sem ninguém decidir.
    expect(entrada).toEqual({
      clientId: 7,
      qtdePlanoHoras: 15,
      creditoHoras: 2,
      qtdePlanoEfetivoHoras: 17,
    })
    // As duas leituras erradas de `horasPlanoSegundos` que o nome do campo convida:
    // 9900 (cru) e 2,75 (convertido). Nenhuma delas é a base.
    expect(entrada.qtdePlanoHoras).not.toBe(9900)
    expect(entrada.qtdePlanoHoras).not.toBe(2.75)
  })

  it('cliente sem plano e sem override: base 0 — o mesmo `?? 0` do backend', () => {
    const entrada = entradaDoPlanoEfetivoDoRelatorio(
      relatorio({
        client: { ...relatorio().client, horasEfetivas: null },
        creditoHoras: 2,
        horasPlanoEfetivas: 2,
      }),
    )

    expect(entrada.qtdePlanoHoras).toBe(0)
  })
})

/**
 * A conferência contra o wire é **silenciosa em produção**: ela só fala em DEV. Logo o
 * erro de campo da armadilha 2 não tem sintoma nenhum na tela — e é este par de casos que
 * o torna observável.
 *
 * O par é obrigatório: só a metade "não denuncia" passaria com um `console.error` que nunca
 * é alcançado (`rules/tests.md` § prova por ausência).
 */
describe('a conferência DEV contra `horasPlanoEfetivas`', () => {
  it('wire coerente (15 + 2 = 17) ⇒ NÃO denuncia', () => {
    const erro = vi.spyOn(console, 'error').mockImplementation(() => {})

    derivarCreditoDoRelatorio(relatorio({ creditoHoras: 2, horasPlanoEfetivas: 17 }))

    expect(erro).not.toHaveBeenCalled()
  })

  it('wire incoerente ⇒ denuncia nomeando o cliente, e o texto do crédito continua correto', () => {
    const erro = vi.spyOn(console, 'error').mockImplementation(() => {})

    const credito = derivarCreditoDoRelatorio(
      relatorio({ creditoHoras: 2, horasPlanoEfetivas: 99 }),
    )

    expect(erro).toHaveBeenCalledTimes(1)
    expect(String(erro.mock.calls[0]?.[0])).toContain('cliente 7')
    // A função PROSSEGUE com base + crédito: a denúncia não pode virar tela vazia.
    expect(credito.creditoTexto).toBe('2h 0m')
  })
})

/**
 * 🔴 As CHAVES do wire — o defeito que o TypeScript não pega.
 *
 * O tipo `ClientReportDto` é escrito **por nós**: um nome errado nele é aceito pelo
 * compilador, chega `undefined` em runtime e cai no ramo "não sei" **para sempre**, sem erro
 * nenhum (memória `contrato-wire-backend-frontend`). O risco aqui é concreto e tem nome: a
 * MESMA grandeza se chama `qtdePlanoEfetivoHoras` no Consumo de Planos e
 * `horasPlanoEfetivas` neste DTO (`ReportsDtos.cs:84-96` × `ReportsDtos.cs:283`).
 *
 * Por isso o payload abaixo é **JSON literal**, escrito à mão a partir do record do backend
 * com a política camelCase da API — não um objeto tipado, que provaria apenas que o tipo
 * concorda consigo mesmo.
 */
describe('as chaves do wire', () => {
  const PAYLOAD_DO_WIRE = `{
    "client": {
      "id": 7, "hubspotCompanyId": 10, "cnpj": null,
      "razaoSocial": "ACME LTDA", "nomeFantasia": "ACME",
      "supportPlan": null, "horasOverride": null, "horasEfetivas": 15
    },
    "plano": null,
    "competencia": "2026-08",
    "totalApontamentos": 3,
    "totalSegundos": 13500,
    "horasPlanoSegundos": 9900,
    "horasFaturadoSegundos": 3600,
    "horasNaoFaturadoSegundos": 0,
    "items": null,
    "creditoHoras": 2,
    "horasPlanoEfetivas": HORAS_PLANO_EFETIVAS
  }`

  const doWire = (horasPlanoEfetivas: string): ClientReportDto =>
    JSON.parse(
      PAYLOAD_DO_WIRE.replace('HORAS_PLANO_EFETIVAS', horasPlanoEfetivas),
    ) as ClientReportDto

  it('`creditoHoras` é lido do JSON como o backend o serializa', () => {
    const credito = derivarCreditoDoRelatorio(doWire('17'))

    // Errar o nome da chave no tipo deixa isto vermelho — e é o único jeito de errá-lo ser
    // percebido, porque o compilador não tem como saber o nome real.
    expect(credito.temCredito).toBe(true)
    expect(credito.creditoTexto).toBe('2h 0m')
  })

  it('`horasPlanoEfetivas` é lido do JSON — provado pela conferência que ele dispara', () => {
    const erro = vi.spyOn(console, 'error').mockImplementation(() => {})

    // 15 + 2 = 17, e o wire diz 99: a única forma de a conferência falar é ela ter LIDO a
    // chave. Com o nome errado (ex.: `qtdePlanoEfetivoHoras`, o do Consumo de Planos) o
    // campo viria `undefined`, a conferência seria pulada e este assert ficaria vermelho.
    derivarCreditoDoRelatorio(doWire('99'))
    expect(erro).toHaveBeenCalledTimes(1)

    // Companheira na mesma execução: com o valor coerente ela se cala. Sem esta metade,
    // "denunciou" passaria também num mundo onde a conferência denuncia sempre.
    erro.mockClear()
    derivarCreditoDoRelatorio(doWire('17'))
    expect(erro).not.toHaveBeenCalled()
  })
})
