/**
 * 132/F4c + 134/S1 — **a planilha do Consumo de Planos.**
 *
 * 🔴 *Tela errada o gestor recarrega; planilha errada ele encaminha* (AP-FRONTEND-028, o 4º e
 * mais grave lugar do mesmo campo). Este arquivo é o dono das duas travas da superfície:
 *
 *  · **134/S1** — a identidade LITERAL do conjunto de chaves `type: 'duration'`. A demanda 134
 *    fixou esse conjunto em **6 nomes** e deixou esta superfície para a onda 2, por colidir com
 *    a 132; a 132 acrescenta `creditoHoras` e `qtdePlanoEfetivoHoras`, levando o conjunto a
 *    **8**, e §10.2 da análise nomeia **quem entra por último** como dono do literal. Sou eu.
 *  · **132/F4c** — as duas colunas novas, o guard de crédito desconhecido (célula **vazia**,
 *    nunca `0`) e a fonte no nome do arquivo.
 *
 * O que cada asserção existe para deixar VERMELHA:
 *
 *  1. coluna de hora nova entrando sem `type: 'duration'`, ou uma saindo → a identidade cai,
 *     **nomeando** a chave (cardinalidade passaria com uma entrando e outra saindo);
 *  2. `percentualPlano` ganhando `type: 'duration'` → o Excel tentaria somar percentual como
 *     tempo; o assert de exclusão nominal cai;
 *  3. o mapper voltando a pré-formatar (`'2h 44m'`) → `assertCelulasDeDuracaoSaoNumericas` cai
 *     em todas as chaves derivadas;
 *  4. 🔴 um `?? 0` no crédito → a planilha afirmaria "não há crédito" durante todo o intervalo
 *     entre os dois deploys; o caso do crédito **desconhecido** cai;
 *  5. `qtdePlanoHoras` passando a somar o crédito → o caso que compara as três colunas cai;
 *  6. o nome do arquivo perdendo a fonte → o export de mês fechado ficaria indistinguível do
 *     de período personalizado depois de sair do sistema;
 *  7. 🔴 **135/G1** — a coluna `Qtde. Tickets` ganhando `type: 'duration'` (12 chamados sairiam
 *     como `00:00:12`), ou o mapper colapsando "não sei" em `0` (a planilha afirmaria "nenhum
 *     chamado aberto" durante toda a janela entre os dois deploys).
 */

import { describe, expect, it } from 'vitest'
import {
  PLAN_CONSUMPTION_EXPORT_COLUMNS,
  nomeDoArquivoDeExport,
  planConsumptionExportRow,
} from './index'
import {
  assertCelulasDeDuracaoSaoNumericas,
  chavesDeDuracao,
} from '../../../test/duracaoExport'
import type { PlanConsumptionItemDto } from '../shared/types/reports'

function linha(over: Partial<PlanConsumptionItemDto> = {}): PlanConsumptionItemDto {
  return {
    clientId: 1,
    cnpj: '12345678000195',
    nomeFantasia: 'Cliente Exemplo',
    razaoSocial: 'Cliente Exemplo LTDA',
    nomePlano: 'Support Elite',
    qtdePlanoHoras: 15,
    horasUsadas: 2.75,
    horasRestantes: 14.25,
    horasAdicionais: 0,
    percentualPlano: 16.18,
    horasFaturaveis: 0,
    horasAnalise: 0,
    ...over,
  }
}

describe('134/S1 + 132/F4c — o conjunto de colunas de duração', () => {
  it('🔴 a identidade literal do conjunto `duration` é esta (6 da 134 + 2 da 132 = 8)', () => {
    // Derivado da declaração real das colunas (`chavesDeDuracao`), comparado com literal
    // escrito à mão. É a trava que a 134/§8.3 pediu, atualizada por quem entrou por último.
    expect(chavesDeDuracao(PLAN_CONSUMPTION_EXPORT_COLUMNS)).toEqual([
      'qtdePlanoHoras',
      // ── as duas da 132/F4c ──
      'creditoHoras',
      'qtdePlanoEfetivoHoras',
      // ── as 5 restantes da 134/S1 ──
      'horasUsadas',
      'horasRestantes',
      'horasAdicionais',
      'horasFaturaveis',
      'horasAnalise',
    ])
  })

  it('🔴 `percentualPlano` NÃO é duração (percentual não se soma como tempo)', () => {
    expect(chavesDeDuracao(PLAN_CONSUMPTION_EXPORT_COLUMNS)).not.toContain('percentualPlano')
    // Companheira positiva: a coluna existe, e é de texto — a negativa acima não passa por
    // ausência da coluna.
    const percentual = PLAN_CONSUMPTION_EXPORT_COLUMNS.find((c) => c.key === 'percentualPlano')
    expect(percentual?.header).toBe('% do Plano')
    expect(percentual?.type).toBeUndefined()
  })

  it('🔴 T-15: `qtdeTickets` NÃO é duração — contagem não é tempo (135/G1)', () => {
    // Com `type: 'duration'` o núcleo do export trataria o número como SEGUNDOS: 12 chamados
    // sairiam `00:00:12` no CSV e como fração de dia com `numFmt [h]:mm:ss` no XLSX.
    expect(chavesDeDuracao(PLAN_CONSUMPTION_EXPORT_COLUMNS)).not.toContain('qtdeTickets')
    // 🔴 Companheira POSITIVA — sem ela a negativa acima passaria pela AUSÊNCIA da coluna,
    // que é exatamente o outro defeito (coluna da tela que não chega na planilha).
    const contagem = PLAN_CONSUMPTION_EXPORT_COLUMNS.find((c) => c.key === 'qtdeTickets')
    expect(contagem?.header).toBe('Qtde. Tickets')
    expect(contagem?.type).toBeUndefined()
  })

  it('a ORDEM e os cabeçalhos das 14 colunas são estes — a planilha espelha a tela', () => {
    // As duas colunas novas vêm imediatamente DEPOIS de "Qtde. Plano (h)": é a leitura das
    // três juntas que explica o número (§3.5 da análise).
    expect(PLAN_CONSUMPTION_EXPORT_COLUMNS.map((c) => c.header)).toEqual([
      'CNPJ',
      'Nome Fantasia',
      'Razão Social',
      'Nome do Plano',
      'Qtde. Plano (h)',
      'Crédito (h)',
      'Plano Efetivo (h)',
      'Horas Usadas',
      'Horas Restantes',
      'Horas Adicionais',
      '% do Plano',
      'Horas Faturáveis',
      'Horas de Análise',
      // 135/G1 — a contagem entra por ÚLTIMO: nenhum índice das 13 anteriores se desloca
      // (é o que preserva `columns.wire.test.tsx` e os fixtures desta suíte).
      'Qtde. Tickets',
    ])
  })

  it('as células de duração são NUMÉRICAS (segundos), nunca "2h 45m"', () => {
    const rows = [
      planConsumptionExportRow(linha({ creditoHoras: 2 })),
      planConsumptionExportRow(linha({ creditoHoras: 0 })),
    ]
    // O helper já começa pelos controles positivos (chaves > 0 e linhas > 0), então a
    // asserção não é satisfeita pelo vazio.
    assertCelulasDeDuracaoSaoNumericas(PLAN_CONSUMPTION_EXPORT_COLUMNS, rows)
  })
})

describe('132/F4c — os três números do plano na planilha', () => {
  it('🔴 `Qtde. Plano (h)` continua sendo o plano BASE; o efetivo é coluna própria', () => {
    const row = planConsumptionExportRow(linha({ creditoHoras: 2 }))

    // 15h = 54000s · crédito 2h = 7200s · efetivo 17h = 61200s.
    // Somar o crédito dentro de `qtdePlanoHoras` faria a planilha de um mês COM crédito
    // divergir da de um mês SEM crédito, sem nenhum sinal no arquivo.
    expect(row.qtdePlanoHoras).toBe(54_000)
    expect(row.creditoHoras).toBe(7_200)
    expect(row.qtdePlanoEfetivoHoras).toBe(61_200)
  })

  it('🔴 crédito DESCONHECIDO ⇒ as duas células ficam VAZIAS (`null`), nunca `0`', () => {
    const semChave = planConsumptionExportRow(linha())
    const nuloExplicito = planConsumptionExportRow(linha({ creditoHoras: null }))

    for (const row of [semChave, nuloExplicito]) {
      // `0` afirmaria "não há crédito"; vazio afirma "não sei" — que é a verdade contra um
      // backend anterior à 132. E `Plano Efetivo` vazio é obrigatório pelo mesmo motivo:
      // repetir o base ali afirmaria que não houve crédito.
      expect(row.creditoHoras).toBeNull()
      expect(row.qtdePlanoEfetivoHoras).toBeNull()
      // Companheira positiva: a linha existe e as outras colunas saíram.
      expect(row.qtdePlanoHoras).toBe(54_000)
      expect(row.nomePlano).toBe('Support Elite')
    }
  })

  it('🔴 crédito CONHECIDO e zero ⇒ `0` e o efetivo igual ao base (regressão zero)', () => {
    const row = planConsumptionExportRow(linha({ creditoHoras: 0 }))

    // É o par do caso acima: a planilha DISTINGUE "não sei" de "não há" — a tela, de
    // propósito, não. Sem estes dois casos juntos, um `?? 0` passaria.
    expect(row.creditoHoras).toBe(0)
    expect(row.qtdePlanoEfetivoHoras).toBe(54_000)
  })

  it('hora negativa em `horasRestantes` (plano estourado) é clampada em 0', () => {
    // `durationCellFromHours` clampa, que é o mesmo valor que `formatHours` já produzia — e
    // evita `########` no Excel, que não exibe tempo negativo.
    const row = planConsumptionExportRow(linha({ horasRestantes: -3 }))
    expect(row.horasRestantes).toBe(0)
  })

  it('`% do Plano` continua TEXTO formatado com 1 casa (D21)', () => {
    expect(planConsumptionExportRow(linha({ percentualPlano: 16.08 })).percentualPlano).toBe(
      '16,1%',
    )
    expect(planConsumptionExportRow(linha({ percentualPlano: null })).percentualPlano).toBe('—')
  })

  it('as colunas de cadastro ausentes saem como "—" (comportamento preservado)', () => {
    const row = planConsumptionExportRow(
      linha({ cnpj: null, nomeFantasia: null, razaoSocial: null, nomePlano: null }),
    )
    expect([row.cnpj, row.nomeFantasia, row.razaoSocial, row.nomePlano]).toEqual([
      '—',
      '—',
      '—',
      '—',
    ])
  })
})

describe('135/G1 — a contagem de chamados na planilha', () => {
  it('🔴 T-14: número CRU; `0` é `0`; ausente e nulo saem VAZIOS (`null`), nunca `0`', () => {
    // Os quatro ramos na MESMA execução — é o conjunto que discrimina, nunca um deles
    // sozinho: `?? 0` passa no caso `12`; `String(...)` passa nos dois de ausência;
    // `?? '—'` passa no caso `0`.
    const doze = planConsumptionExportRow(linha({ qtdeTickets: 12 }))
    expect(doze.qtdeTickets).toBe(12)
    // `12`, e não `'12'`: célula de texto não soma no Excel.
    expect(typeof doze.qtdeTickets).toBe('number')

    // `0` é o valor NORMAL a partir da 135 — "nenhum chamado aberto no período".
    expect(planConsumptionExportRow(linha({ qtdeTickets: 0 })).qtdeTickets).toBe(0)

    // Nulo explícito e chave AUSENTE são "não sei" (backend anterior à 135). A planilha
    // que vai por e-mail não pode afirmar "zero chamados" sobre um valor desconhecido.
    expect(planConsumptionExportRow(linha({ qtdeTickets: null })).qtdeTickets).toBeNull()
    expect(planConsumptionExportRow(linha()).qtdeTickets).toBeNull()
  })

  it('🔴 T-14b: os fixtures DISCRIMINAM chave AUSENTE × chave nula', () => {
    // Sem isto, alguém "conserta" o fixture pondo `qtdeTickets: null` e o par de cima
    // volta a passar nos dois mundos (é `columns.wire.test.tsx:67-77`, mesma técnica).
    const semChave = linha()
    const comNulo = linha({ qtdeTickets: null })
    expect(Object.hasOwn(semChave, 'qtdeTickets')).toBe(false)
    expect(Object.hasOwn(comNulo, 'qtdeTickets')).toBe(true)
  })

  it('a contagem NÃO interfere nas demais células da linha (controle positivo)', () => {
    // A negativa "não vira duração" não pode passar por uma linha que não saiu.
    const row = planConsumptionExportRow(linha({ qtdeTickets: 7, creditoHoras: 2 }))
    expect(row.qtdeTickets).toBe(7)
    expect(row.qtdePlanoHoras).toBe(54_000)
    expect(row.creditoHoras).toBe(7_200)
    expect(row.nomePlano).toBe('Support Elite')
  })
})

describe('132/§3.5 — a FONTE do número sai no nome do arquivo', () => {
  it('snapshot e ao vivo produzem nomes distintos, com a competência', () => {
    // Depois que o arquivo sai do sistema, um export de mês fechado é indistinguível de um
    // export de período livre — e os dois respondem perguntas diferentes sobre o MESMO mês.
    expect(nomeDoArquivoDeExport('snapshot', '2026-08')).toBe('consumo-planos-2026-08-snapshot')
    expect(nomeDoArquivoDeExport('aovivo', '2026-09')).toBe('consumo-planos-2026-09-ao-vivo')
  })

  it('sem competência (período personalizado) o nome não inventa uma', () => {
    expect(nomeDoArquivoDeExport('aovivo', null)).toBe('consumo-planos-ao-vivo')
  })

  it('🔴 fonte desconhecida ⇒ nome SEM sufixo (não afirma nada)', () => {
    // Fail-closed também aqui: contra backend anterior à 132 o arquivo volta a se chamar
    // como se chamava, em vez de afirmar "ao vivo" sobre algo que não se sabe.
    expect(nomeDoArquivoDeExport(null, null)).toBe('consumo-planos')
    expect(nomeDoArquivoDeExport(undefined, undefined)).toBe('consumo-planos')
  })

  it('token inválido do servidor também não vira sufixo', () => {
    const nome = nomeDoArquivoDeExport('mosaico', '2026-08')
    expect(nome).toBe('consumo-planos-2026-08')
    expect(nome).not.toContain('mosaico')
  })
})
