import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { HolidayImpactDto } from '../types/calendar'
import {
  datasParaConsultarNoLote,
  datasRetroativas,
  estadoDoImpacto,
  exigeConfirmacaoRetroativa,
  impactoBloqueiaConfirmacao,
  listaDeDatasResumida,
  MAX_DATAS_CONSULTADAS_NO_LOTE,
  MAX_DATAS_LISTADAS_NO_LOTE,
  somaDosImpactos,
  textoConfirmacaoRetroativa,
  textoConfirmacaoRetroativaEmLote,
  textoImpactos,
  tituloConfirmacaoRetroativa,
  tituloConfirmacaoRetroativaEmLote,
  type ResultadoDeImpacto,
} from './retroactiveWarning'

/**
 * DD-2 — mexer em feriado passado muda indicador do passado, e a contagem tem de estar na
 * frente do usuário **antes** da decisão.
 *
 * O relógio é fixado em 2026-09-06 12:00 SP para que "passado" seja um fato do teste, e não
 * do dia em que ele roda.
 */

function erroApi(status: number, code: string, message: string): AxiosError {
  const config = { headers: new AxiosHeaders() }
  const response: AxiosResponse = {
    data: { error: { code, message } },
    status,
    statusText: '',
    headers: {},
    config,
  }
  return new AxiosError(`Request failed with status code ${status}`, undefined, config, {}, response)
}

function resultado(overrides: Partial<ResultadoDeImpacto>): ResultadoDeImpacto {
  return { isLoading: false, isError: false, error: null, data: undefined, ...overrides }
}

const impacto = (data: string, retroativo: boolean, tickets: number): HolidayImpactDto => ({
  data,
  avisoRetroativo: retroativo,
  ticketsFechadosNoDia: tickets,
})

describe('retroactiveWarning — quais datas disparam a confirmação', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-06T15:00:00Z')) // 12:00 em São Paulo
  })
  afterEach(() => vi.useRealTimers())

  /**
   * 124/`P-6` — este teste travava *"hoje e futuro, não"*. **Reescrito afirmando a
   * correção**, e mais específico: agora nomeia os três dias e o motivo de cada um.
   *
   * O que faz o assert de HOJE ficar vermelho: voltar `ehDiaRetroativo` para `< hoje`.
   * O que faz o de HOJE + 1 ficar vermelho: afrouxar a fronteira para o dia seguinte.
   */
  it('ontem e HOJE exigem confirmação; hoje + 1 e futuro, não (P-6)', () => {
    expect(exigeConfirmacaoRetroativa(['2026-09-05'])).toBe(true)
    // 🔴 A mudança de `P-6`: chamado fechado hoje de manhã já tem indicador apurado.
    expect(exigeConfirmacaoRetroativa(['2026-09-06'])).toBe(true)
    expect(exigeConfirmacaoRetroativa(['2026-09-07'])).toBe(false)
    expect(exigeConfirmacaoRetroativa(['2026-12-25'])).toBe(false)
  })

  it('HOJE entra na lista de datas consultadas — e é a única data "de hoje" possível', () => {
    // Companheira positiva do bloco acima na forma de lista: sem ela, "não vejo amanhã"
    // passaria com a função devolvendo sempre `[]`.
    expect(datasRetroativas(['2026-09-07', '2026-09-06'])).toEqual(['2026-09-06'])
  })

  it('na EDIÇÃO as duas datas contam — mover de ontem para amanhã também mexe no passado', () => {
    // O que faz este assert ficar vermelho: olhar só a data nova.
    expect(datasRetroativas(['2026-12-25', '2026-09-05'])).toEqual(['2026-09-05'])
    expect(datasRetroativas(['2026-09-05', '2026-03-04'])).toEqual(['2026-09-05', '2026-03-04'])
  })

  it('null/undefined e repetição não geram consulta', () => {
    expect(datasRetroativas([null, undefined])).toEqual([])
    expect(datasRetroativas(['2026-09-05', '2026-09-05'])).toEqual(['2026-09-05'])
  })

  it('data futura NÃO gera consulta nenhuma — é o caminho rápido', () => {
    expect(datasRetroativas(['2026-12-25', null])).toEqual([])
    // A fronteira exata: hoje + 1 já é futuro.
    expect(datasRetroativas(['2026-09-07'])).toEqual([])
  })

  it('títulos por ação — "de hoje ou anterior", nunca "passada" (P-6)', () => {
    // Reescrito: travava "…em data passada", que passou a ser FALSO para o caso de hoje.
    expect(tituloConfirmacaoRetroativa('remover')).toBe(
      'Remover feriado em data de hoje ou anterior',
    )
    expect(tituloConfirmacaoRetroativa('criar')).toBe(
      'Cadastrar feriado em data de hoje ou anterior',
    )
    expect(tituloConfirmacaoRetroativa('editar')).toBe(
      'Alterar feriado em data de hoje ou anterior',
    )
  })
})

describe('estadoDoImpacto — "ainda não sei" nunca vira "não há"', () => {
  it('sem consultas é ocioso', () => {
    expect(estadoDoImpacto([])).toEqual({ tipo: 'ocioso' })
  })

  it('qualquer consulta carregando mantém o estado em carregando', () => {
    expect(
      estadoDoImpacto([
        resultado({ data: impacto('2026-03-04', true, 12) }),
        resultado({ isLoading: true }),
      ]).tipo,
    ).toBe('carregando')
  })

  it('carregando VENCE erro — a resposta que falta ainda pode mudar o total', () => {
    const estado = estadoDoImpacto([
      resultado({ isError: true, error: erroApi(404, 'NOT_FOUND', 'Calendário não encontrado.') }),
      resultado({ isLoading: true }),
    ])
    expect(estado.tipo).toBe('carregando')
  })

  it('erro vira mensagem do envelope, nunca toast genérico', () => {
    const estado = estadoDoImpacto([
      resultado({ isError: true, error: erroApi(404, 'NOT_FOUND', 'Calendário não encontrado.') }),
    ])
    expect(estado).toEqual({ tipo: 'erro', mensagem: 'Calendário não encontrado.' })
  })

  it('422 VALIDATION_ERROR também chega com a mensagem do servidor', () => {
    const estado = estadoDoImpacto([
      resultado({
        isError: true,
        error: erroApi(422, 'VALIDATION_ERROR', 'Data deve estar no formato AAAA-MM-DD.'),
      }),
    ])
    expect(estado).toEqual({
      tipo: 'erro',
      mensagem: 'Data deve estar no formato AAAA-MM-DD.',
    })
  })

  it('todas respondidas viram pronto, na ordem consultada', () => {
    expect(
      estadoDoImpacto([
        resultado({ data: impacto('2026-03-04', true, 12) }),
        resultado({ data: impacto('2026-01-01', true, 3) }),
      ]),
    ).toEqual({
      tipo: 'pronto',
      impactos: [impacto('2026-03-04', true, 12), impacto('2026-01-01', true, 3)],
    })
  })

  it('resposta faltando (sem loading e sem erro) NÃO vira pronto', () => {
    // Um "pronto" com menos impactos que consultas mostraria um total incompleto como se
    // fosse o total.
    expect(estadoDoImpacto([resultado({ data: impacto('2026-03-04', true, 12) }), resultado({})]).tipo).toBe(
      'carregando',
    )
  })
})

describe('impactoBloqueiaConfirmacao', () => {
  it('trava só enquanto carrega', () => {
    expect(impactoBloqueiaConfirmacao({ tipo: 'carregando' })).toBe(true)
  })

  it('não trava em erro — a data que a pré-contagem recusa a escrita também recusa', () => {
    expect(impactoBloqueiaConfirmacao({ tipo: 'erro', mensagem: 'x' })).toBe(false)
    expect(impactoBloqueiaConfirmacao({ tipo: 'ocioso' })).toBe(false)
    expect(
      impactoBloqueiaConfirmacao({ tipo: 'pronto', impactos: [impacto('2026-03-04', true, 1)] }),
    ).toBe(false)
  })
})

describe('textoImpactos — o número, e o 0 que não é impacto', () => {
  it('data retroativa mostra a contagem, com singular e plural', () => {
    expect(textoImpactos([impacto('2026-03-04', true, 12)])).toBe(
      '04/03/2026: 12 chamados já fechados naquele dia têm os indicadores recalculados.',
    )
    expect(textoImpactos([impacto('2026-03-04', true, 1)])).toBe(
      '04/03/2026: 1 chamado já fechado naquele dia tem os indicadores recalculados.',
    )
  })

  it('data retroativa COM ZERO mostra o zero — ali ele é medida de verdade', () => {
    expect(textoImpactos([impacto('2026-03-04', true, 0)])).toContain('0 chamados já fechados')
  })

  it('🔴 data NÃO retroativa não exibe número nenhum — o 0 dali significa outra coisa', () => {
    // 124/`P-6` — o texto travado aqui era *"não é uma data passada"*. Com a fronteira em
    // `<= hoje`, `avisoRetroativo: false` só acontece de **hoje + 1 em diante**, e por isso
    // a frase foi reescrita para "é uma data futura". A data do caso mudou junto: 06/09 é
    // HOJE nesta suíte e passou a ser retroativa.
    const texto = textoImpactos([impacto('2026-09-07', false, 0)])
    expect(texto).toBe('07/09/2026 é uma data futura: nenhum indicador já apurado muda.')
    // O que faz este assert ficar vermelho: voltar a frase antiga, que hoje seria mentira
    // (a data NÃO é "não passada" por acaso — ela é futura).
    expect(texto).not.toContain('não é uma data passada')
    // O que faz este assert ficar vermelho: imprimir `ticketsFechadosNoDia` neste caso, que
    // faria "0" ser lido como "verifiquei e não há impacto".
    expect(texto).not.toContain('0 chamado')
    expect(texto).not.toContain('chamados já fechados')
  })

  it('duas datas produzem duas frases', () => {
    const texto = textoImpactos([impacto('2026-03-04', true, 2), impacto('2026-01-01', true, 5)])
    expect(texto).toContain('04/03/2026: 2 chamados')
    expect(texto).toContain('01/01/2026: 5 chamados')
  })
})

describe('textoConfirmacaoRetroativa — nunca afirma número antes da resposta', () => {
  const datas = ['2026-03-04']

  it('carregando diz que está consultando, e não mostra número', () => {
    const texto = textoConfirmacaoRetroativa('remover', datas, { tipo: 'carregando' })
    expect(texto).toContain('04/03/2026')
    expect(texto).toContain('Consultando quantos chamados fechados são afetados')
    expect(texto).not.toMatch(/\d+ chamado/)
  })

  it('erro diz que NÃO CONSEGUIU consultar — nunca que não há impacto', () => {
    const texto = textoConfirmacaoRetroativa('remover', datas, {
      tipo: 'erro',
      mensagem: 'Calendário não encontrado.',
    })
    expect(texto).toContain('Não foi possível consultar quantos chamados são afetados')
    expect(texto).toContain('Calendário não encontrado.')
    expect(texto).not.toMatch(/\d+ chamado/)
  })

  it('pronto traz a contagem real junto da explicação do que muda', () => {
    const texto = textoConfirmacaoRetroativa('remover', datas, {
      tipo: 'pronto',
      impactos: [impacto('2026-03-04', true, 12)],
    })
    expect(texto).toContain('indicadores já apurados mudam de valor')
    expect(texto).toContain('12 chamados já fechados')
  })

  it('duas datas aparecem as duas no cabeçalho da frase', () => {
    const texto = textoConfirmacaoRetroativa('editar', ['2026-03-04', '2026-01-01'], {
      tipo: 'pronto',
      impactos: [impacto('2026-03-04', true, 2), impacto('2026-01-01', true, 5)],
    })
    expect(texto).toContain('as datas 04/03/2026 e 01/01/2026, de hoje ou anteriores')
  })

  it('124/P-6: a frase de abertura NÃO afirma mais "anterior a hoje" — hoje entrou', () => {
    // Travava, antes, a redação `…envolve a data 04/03/2026, anterior a hoje.` Ela ficou
    // falsa para o caso de HOJE, que a mesma frase agora cobre.
    const texto = textoConfirmacaoRetroativa('criar', ['2026-09-06'], { tipo: 'ocioso' })
    expect(texto).toContain('a data 06/09/2026, de hoje ou anterior')
    expect(texto).not.toContain('anterior a hoje')
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// QA `D-1` — a MESMA guarda, no lote
// ─────────────────────────────────────────────────────────────────────────────

describe('retroactiveWarning — teto de consultas do lote', () => {
  const trintaEDuas = Array.from(
    { length: 32 },
    (_, i) => `2026-01-${String(i + 1).padStart(2, '0')}`,
  )

  it('consulta no máximo o teto, preservando a ordem do arquivo', () => {
    const consultadas = datasParaConsultarNoLote(trintaEDuas)
    expect(consultadas).toHaveLength(MAX_DATAS_CONSULTADAS_NO_LOTE)
    expect(consultadas[0]).toBe('2026-01-01')
    expect(consultadas.at(-1)).toBe('2026-01-30')
  })

  it('lote pequeno não é truncado — companheira positiva do teste acima', () => {
    const doze = trintaEDuas.slice(0, 12)
    expect(datasParaConsultarNoLote(doze)).toEqual(doze)
  })

  it('a lista por extenso corta no teto de EXIBIÇÃO e diz quantas sobraram', () => {
    const texto = listaDeDatasResumida(trintaEDuas)
    expect(texto).toContain('01/01/2026')
    expect(texto).toContain(`e mais ${32 - MAX_DATAS_LISTADAS_NO_LOTE}`)
    // A 11a data não aparece: o corte é real, não decorativo.
    expect(texto).not.toContain('11/01/2026')
  })

  it('lista curta sai inteira, sem "e mais"', () => {
    expect(listaDeDatasResumida(['2026-01-01', '2026-04-21'])).toBe('01/01/2026, 21/04/2026')
  })
})

describe('retroactiveWarning — soma dos impactos do lote', () => {
  it('soma só as datas que o servidor confirmou como retroativas', () => {
    const soma = somaDosImpactos([
      impacto('2026-01-01', true, 12),
      impacto('2026-04-21', true, 3),
      impacto('2026-09-06', false, 0),
    ])
    // Cardinalidade assimétrica de propósito (12 ≠ 3): inverter o predicado do filtro
    // não produziria 15.
    expect(soma).toEqual({ chamados: 15, datasComAviso: 2, datasSemAviso: 1 })
  })

  it('data marcada como não retroativa não entra nem com contagem > 0', () => {
    const soma = somaDosImpactos([impacto('2026-09-06', false, 99)])
    expect(soma.chamados).toBe(0)
    expect(soma.datasSemAviso).toBe(1)
  })
})

describe('retroactiveWarning — texto da confirmação do LOTE', () => {
  const duas = ['2026-01-01', '2026-04-21']

  it('título traz a contagem de datas e o singular correto (P-6: "de hoje ou anterior")', () => {
    expect(tituloConfirmacaoRetroativaEmLote(2)).toBe(
      'Importar 2 feriados em datas de hoje ou anteriores',
    )
    expect(tituloConfirmacaoRetroativaEmLote(1)).toBe(
      'Importar 1 feriado em data de hoje ou anterior',
    )
  })

  it('carregando NÃO afirma número nenhum — nem 0', () => {
    const texto = textoConfirmacaoRetroativaEmLote(10, duas, { tipo: 'carregando' })
    expect(texto).toContain('Consultando quantos chamados fechados são afetados')
    expect(texto).not.toMatch(/\d+ chamado/)
  })

  it('erro diz que NÃO CONSEGUIU consultar — nunca que não há impacto', () => {
    const texto = textoConfirmacaoRetroativaEmLote(10, duas, {
      tipo: 'erro',
      mensagem: 'Calendário não encontrado.',
    })
    expect(texto).toContain('Não foi possível consultar quantos chamados são afetados')
    expect(texto).not.toMatch(/\d+ chamado/)
  })

  it('pronto traz a SOMA, as datas e o tamanho do lote', () => {
    const texto = textoConfirmacaoRetroativaEmLote(10, duas, {
      tipo: 'pronto',
      impactos: [impacto('2026-01-01', true, 12), impacto('2026-04-21', true, 3)],
    })
    expect(texto).toContain('2 datas de hoje ou anteriores')
    expect(texto).toContain('01/01/2026, 21/04/2026')
    expect(texto).toContain('de 10 linhas do arquivo')
    expect(texto).toContain('Ao todo, 15 chamados já fechados têm os indicadores recalculados')
    // Sem o "efeito real é maior": nada foi truncado.
    expect(texto).not.toContain('efeito real é maior')
  })

  it('lote truncado diz que o número é PISO, e quantas datas ficaram de fora', () => {
    const quarenta = Array.from(
      { length: 40 },
      (_, i) => `2026-01-${String(i + 1).padStart(2, '0')}`,
    )
    const impactos = quarenta
      .slice(0, MAX_DATAS_CONSULTADAS_NO_LOTE)
      .map((d) => impacto(d, true, 2))

    const texto = textoConfirmacaoRetroativaEmLote(60, quarenta, { tipo: 'pronto', impactos })

    expect(texto).toContain('40 datas de hoje ou anteriores')
    expect(texto).toContain(`Nas ${MAX_DATAS_CONSULTADAS_NO_LOTE} primeiras dessas datas`)
    expect(texto).toContain('60 chamados já fechados')
    expect(texto).toContain(`as outras ${40 - MAX_DATAS_CONSULTADAS_NO_LOTE} não foram consultadas`)
    expect(texto).toContain('o efeito real é maior')
  })

  it('data que o servidor não considera passada é reportada à parte, fora da soma', () => {
    const texto = textoConfirmacaoRetroativaEmLote(3, duas, {
      tipo: 'pronto',
      impactos: [impacto('2026-01-01', true, 12), impacto('2026-04-21', false, 0)],
    })
    expect(texto).toContain('Ao todo, 12 chamados')
    expect(texto).toContain('1 data não é considerada retroativa pelo servidor')
  })

  it('singular de uma data só sai em português correto — nada de "1 data(s)"', () => {
    const texto = textoConfirmacaoRetroativaEmLote(1, ['2026-01-01'], {
      tipo: 'pronto',
      impactos: [impacto('2026-01-01', true, 1)],
    })
    expect(texto).toContain('1 data de hoje ou anterior')
    expect(texto).toContain('de 1 linha do arquivo')
    expect(texto).toContain('1 chamado já fechado tem os indicadores recalculados')
    expect(texto).not.toContain('(s)')
  })
})
