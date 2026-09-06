/**
 * 124/F4 — os dois vazios do SLA e o limite de confiabilidade do FCR, em unidade.
 *
 * Estes testes provam a DECISÃO. A prova de que a decisão chega à tela (e com que
 * palavras) é irmã, não substituta, e vive em `SupportSlaSection.test.tsx`
 * (`rules/tests.md` § o sujeito da frase decide o tipo de teste).
 *
 * Premissa que estes testes documentam, e que vem do backend (conferida no código, não
 * no nome): `ticketsAbertos` e o universo de elegibilidade do SLA usam o MESMO recorte
 * (`HsCriadoEm ∈ [from, toExclusive)`) e o MESMO escopo (equipe + cliente, sem
 * `supportPlanId`). Se um dos dois mudar no backend, o discriminador dos dois vazios
 * degrada — e é aqui que se descobre.
 */

import { describe, expect, it } from 'vitest'
import {
  ACAO_SLA_NAO_CONFIGURADO,
  ACAO_SLA_NAO_CONFIGURADO_META,
  ACAO_SLA_NAO_CONFIGURADO_SEM_ACESSO,
  DETALHE_SLA_INDETERMINADO,
  PRE_CONDICAO_DO_CALCULO_DO_SLA,
  DETALHE_SLA_SEM_CHAMADOS,
  TITULO_AVISO_FCR,
  TITULO_SLA_INDETERMINADO,
  TITULO_SLA_NAO_CONFIGURADO,
  TITULO_SLA_SEM_CHAMADOS,
  avisoDeHistoricoDoFcr,
  detalheSlaNaoConfigurado,
  estadoDoSla,
  inicioEfetivoDoPeriodo,
  textoDoAvisoDeHistoricoDoFcr,
} from './supportSlaStates'

describe('estadoDoSla — os dois números presentes', () => {
  it('classifica como "ok" e devolve os números quando os dois vieram', () => {
    expect(
      estadoDoSla({
        respondidosNoPrazo: 7,
        respondidosForaDoPrazo: 3,
        chamadosNoPeriodo: 10,
      }),
    ).toEqual({ tipo: 'ok', noPrazo: 7, foraDoPrazo: 3 })
  })

  it('ZERO É NÚMERO: 0 no prazo e 0 fora do prazo continua sendo "ok", não vazio', () => {
    // O backend só devolve 0 quando HOUVE apuração. Colapsar 0 com null seria a
    // metade simétrica do defeito que esta unidade existe para impedir.
    expect(
      estadoDoSla({
        respondidosNoPrazo: 0,
        respondidosForaDoPrazo: 0,
        chamadosNoPeriodo: 4,
      }),
    ).toEqual({ tipo: 'ok', noPrazo: 0, foraDoPrazo: 0 })
  })
})

describe('estadoDoSla — os DOIS vazios, que não podem virar um só', () => {
  it('null com chamados no período ⇒ "nao-configurado", carregando a contagem', () => {
    expect(
      estadoDoSla({
        respondidosNoPrazo: null,
        respondidosForaDoPrazo: null,
        chamadosNoPeriodo: 12,
      }),
    ).toEqual({ tipo: 'nao-configurado', chamadosNoPeriodo: 12 })
  })

  it('null SEM chamado no período ⇒ "sem-chamados" — nunca "não configurado"', () => {
    expect(
      estadoDoSla({
        respondidosNoPrazo: null,
        respondidosForaDoPrazo: null,
        chamadosNoPeriodo: 0,
      }),
    ).toEqual({ tipo: 'sem-chamados' })
  })

  it('null sem o discriminador ⇒ "indeterminado" — não afirma nenhuma das duas causas', () => {
    expect(
      estadoDoSla({
        respondidosNoPrazo: null,
        respondidosForaDoPrazo: null,
        chamadosNoPeriodo: null,
      }),
    ).toEqual({ tipo: 'indeterminado' })
  })

  it('discriminador AUSENTE (undefined) é tratado como nulo — nunca como zero', () => {
    // AP-FRONTEND-028: `=== undefined` seria o guard errado para campo da rede; e
    // tratar ausência como 0 diria "sem chamados" sem ter medido nada.
    expect(
      estadoDoSla({ respondidosNoPrazo: null, respondidosForaDoPrazo: null }),
    ).toEqual({ tipo: 'indeterminado' })
  })

  it('estado PARCIAL (um lado null) não é apurável: cai no vazio, nunca em "ok"', () => {
    expect(
      estadoDoSla({
        respondidosNoPrazo: 4,
        respondidosForaDoPrazo: null,
        chamadosNoPeriodo: 9,
      }),
    ).toEqual({ tipo: 'nao-configurado', chamadosNoPeriodo: 9 })
    expect(
      estadoDoSla({
        respondidosNoPrazo: null,
        respondidosForaDoPrazo: 4,
        chamadosNoPeriodo: 0,
      }),
    ).toEqual({ tipo: 'sem-chamados' })
  })
})

describe('textos dos dois vazios — distintos, e nenhum deles diz "zero"', () => {
  it('o título de "não configurado" usa as palavras exigidas', () => {
    expect(TITULO_SLA_NAO_CONFIGURADO).toBe('SLA de 1ª resposta não configurado')
  })

  it('o título de "sem chamados" fala do PERÍODO e não de configuração', () => {
    expect(TITULO_SLA_SEM_CHAMADOS).toBe('Nenhum chamado criado no período selecionado')
    expect(TITULO_SLA_SEM_CHAMADOS.toLowerCase()).not.toContain('configurad')
  })

  it('os três títulos são diferentes entre si', () => {
    const titulos = new Set([
      TITULO_SLA_NAO_CONFIGURADO,
      TITULO_SLA_SEM_CHAMADOS,
      TITULO_SLA_INDETERMINADO,
    ])
    expect(titulos.size).toBe(3)
  })

  it('nenhum texto de vazio apresenta valor apurado — vazio não é zero nem 0%', () => {
    // O "1" de "1ª resposta" é ordinal, não medida: a régua é zero/percentual.
    for (const texto of [
      TITULO_SLA_NAO_CONFIGURADO,
      TITULO_SLA_SEM_CHAMADOS,
      TITULO_SLA_INDETERMINADO,
      DETALHE_SLA_SEM_CHAMADOS,
      DETALHE_SLA_INDETERMINADO,
      ACAO_SLA_NAO_CONFIGURADO_SEM_ACESSO,
    ]) {
      expect(texto).not.toMatch(/\b0\b|%|\bzero\b/i)
    }
    // Companheira positiva na MESMA execução: o único texto que TEM número é o que
    // deve tê-lo — e o número é a contagem de chamados, não um indicador.
    expect(detalheSlaNaoConfigurado(12)).toMatch(/\b12\b/)
  })

  it('a explicação de "não configurado" enumera as condições reais, sem eleger uma causa', () => {
    const detalhe = detalheSlaNaoConfigurado(12)
    expect(detalhe).toContain('Nenhum dos 12 chamados criados no período entrou na apuração')
    expect(detalhe).toContain('meta de 1ª resposta')
    expect(detalhe).toContain('expediente')
    expect(detalhe).toContain('isento')
    expect(detalhe).toContain('sem primeiro atendimento')
  })

  /**
   * 124/FE-TXT — reescrito afirmando a correção, e MAIS específico que antes.
   *
   * O `toContain('meta de 1ª resposta')` do teste acima é satisfeito tanto pela frase
   * completa quanto pela incompleta que dizia *"a meta de 1ª resposta no plano do
   * cliente"* — ele não discrimina. Estes travam a PRECEDÊNCIA, que é o fato novo.
   *
   * Fonte da precedência, conferida no backend: `MetricsService.cs:691` →
   * `var meta = fonte.PlanoSlaMinutos ?? metaDoCalendario;`, e `ICalendarioProvider.cs:36-43`
   * descreve `calendarios.slapadraominutos` como a herança de `plano ?? calendário`.
   */
  it('a explicação diz que a meta pode vir do CALENDÁRIO, não só do plano', () => {
    const detalhe = detalheSlaNaoConfigurado(12)
    // POSITIVA: as duas moradas da meta, nomeadas.
    expect(detalhe).toContain('do plano do cliente')
    expect(detalhe).toContain('a meta padrão do calendário')
    // A precedência, que é o que o backend implementa (plano ganha; calendário é o padrão).
    expect(detalhe).toContain('na falta dela')
    // NEGATIVA — só vale por causa das três linhas acima: a redação incompleta,
    // que mandava preencher plano a plano quem já tinha o padrão do calendário.
    expect(detalhe).not.toContain('exige a meta de 1ª resposta no plano do cliente')
  })

  it('a frase da pré-condição é UMA só, e é a exportada — a que o gráfico compartilhado repete', () => {
    // Literal escrito à mão: se a constante mudar sozinha, esta linha cai.
    expect(PRE_CONDICAO_DO_CALCULO_DO_SLA).toBe(
      'O cálculo exige um calendário com expediente cadastrado e uma meta de 1ª resposta — ' +
        'do plano do cliente ou, na falta dela, a meta padrão do calendário.',
    )
    // E o detalhe a usa INTEIRA, sem reescrevê-la por fora.
    expect(detalheSlaNaoConfigurado(12)).toContain(PRE_CONDICAO_DO_CALCULO_DO_SLA)
    expect(detalheSlaNaoConfigurado(1)).toContain(PRE_CONDICAO_DO_CALCULO_DO_SLA)
  })

  it('a chamada de ação não manda mais ao plano quem tem a meta padrão do calendário', () => {
    // Gestor: as duas partes, entre as quais entram os links de Calendário e Planos.
    expect(ACAO_SLA_NAO_CONFIGURADO).toBe('Cadastre o expediente em')
    expect(ACAO_SLA_NAO_CONFIGURADO_META).toContain('padrão do próprio calendário')
    expect(ACAO_SLA_NAO_CONFIGURADO_META).toContain('a do plano em')
    // Sem acesso: mesma verdade, sem link.
    expect(ACAO_SLA_NAO_CONFIGURADO_SEM_ACESSO).toContain('a padrão do calendário')
    expect(ACAO_SLA_NAO_CONFIGURADO_SEM_ACESSO).toContain('a do plano do cliente')
    // A redação antiga, que só conhecia a meta do plano.
    expect(ACAO_SLA_NAO_CONFIGURADO_SEM_ACESSO).not.toContain(
      'cadastrar a meta de 1ª resposta do plano',
    )
  })

  it('concorda em número: 1 chamado não vira "nenhum dos 1 chamados"', () => {
    expect(detalheSlaNaoConfigurado(1)).toContain('O único chamado criado no período')
    expect(detalheSlaNaoConfigurado(1)).not.toContain('dos 1')
  })

  it('formata o milhar em pt-BR', () => {
    expect(detalheSlaNaoConfigurado(1234)).toContain('1.234 chamados')
  })
})

describe('inicioEfetivoDoPeriodo — espelha o default do backend', () => {
  it('devolve o próprio `from` quando ele existe', () => {
    expect(inicioEfetivoDoPeriodo('2026-03-11', '2026-09-06')).toBe('2026-03-11')
  })

  it('sem `from`, o período é o MÊS CORRENTE (FusoSaoPaulo.Resolver), não um período aberto', () => {
    expect(inicioEfetivoDoPeriodo(null, '2026-09-06')).toBe('2026-09-01')
    expect(inicioEfetivoDoPeriodo(undefined, '2026-01-31')).toBe('2026-01-01')
  })

  it('ignora `from` de formato irreconhecível em vez de propagá-lo', () => {
    expect(inicioEfetivoDoPeriodo('11/03/2026', '2026-09-06')).toBe('2026-09-01')
  })
})

describe('avisoDeHistoricoDoFcr — R-3', () => {
  const LIMITE = '2026-05-20T13:00:00Z' // 20/05/2026 10:00 em São Paulo

  it('avisa quando o período começa ANTES do limite', () => {
    expect(
      avisoDeHistoricoDoFcr({
        fcr: 87.5,
        fcrHistoricoDesde: LIMITE,
        periodoInicio: '2026-01-01',
      }),
    ).toEqual({
      limiteDia: '2026-05-20',
      limiteFormatado: '20/05/2026',
      inicioDoPeriodo: '2026-01-01',
    })
  })

  it('NÃO avisa quando o período começa depois do limite — companheira positiva do teste acima', () => {
    expect(
      avisoDeHistoricoDoFcr({
        fcr: 87.5,
        fcrHistoricoDesde: LIMITE,
        periodoInicio: '2026-05-21',
      }),
    ).toBeNull()
  })

  it('avisa no dia EXATO do limite: parte do dia precede o primeiro registro', () => {
    expect(
      avisoDeHistoricoDoFcr({
        fcr: 100,
        fcrHistoricoDesde: LIMITE,
        periodoInicio: '2026-05-20',
      }),
    ).not.toBeNull()
  })

  it('o limite é o dia civil de SÃO PAULO, não o dia UTC', () => {
    // 01/09 02:00 UTC = 31/08 23:00 em SP. Quem tomasse o dia UTC avisaria para um
    // período que começa em 01/09 — e deixaria de avisar para 31/08.
    const madrugadaUtc = '2026-09-01T02:00:00Z'
    expect(
      avisoDeHistoricoDoFcr({
        fcr: 90,
        fcrHistoricoDesde: madrugadaUtc,
        periodoInicio: '2026-08-31',
      })?.limiteFormatado,
    ).toBe('31/08/2026')
    expect(
      avisoDeHistoricoDoFcr({
        fcr: 90,
        fcrHistoricoDesde: madrugadaUtc,
        periodoInicio: '2026-09-01',
      }),
    ).toBeNull()
  })

  it('sem `from`, compara com o 1º dia do mês corrente (o default do backend)', () => {
    expect(
      avisoDeHistoricoDoFcr({
        fcr: 90,
        fcrHistoricoDesde: '2026-09-03T12:00:00Z',
        periodoInicio: null,
        hoje: '2026-09-06',
      }),
    ).not.toBeNull()
    expect(
      avisoDeHistoricoDoFcr({
        fcr: 90,
        fcrHistoricoDesde: '2026-08-03T12:00:00Z',
        periodoInicio: null,
        hoje: '2026-09-06',
      }),
    ).toBeNull()
  })

  it('sem FCR não há o que qualificar — mas FCR ZERO é número e avisa', () => {
    expect(
      avisoDeHistoricoDoFcr({
        fcr: null,
        fcrHistoricoDesde: LIMITE,
        periodoInicio: '2026-01-01',
      }),
    ).toBeNull()
    // Companheira positiva: `0` não pode ser confundido com ausência (`== null`).
    expect(
      avisoDeHistoricoDoFcr({
        fcr: 0,
        fcrHistoricoDesde: LIMITE,
        periodoInicio: '2026-01-01',
      }),
    ).not.toBeNull()
  })

  it('sem `fcrHistoricoDesde` (campo AUSENTE do JSON) não há selo — §4 do be-f4f5', () => {
    expect(
      avisoDeHistoricoDoFcr({ fcr: 90, periodoInicio: '2020-01-01' }),
    ).toBeNull()
    expect(
      avisoDeHistoricoDoFcr({
        fcr: 90,
        fcrHistoricoDesde: null,
        periodoInicio: '2020-01-01',
      }),
    ).toBeNull()
  })

  it('data ilegível não vira limite inventado', () => {
    expect(
      avisoDeHistoricoDoFcr({
        fcr: 90,
        fcrHistoricoDesde: 'ontem',
        periodoInicio: '2020-01-01',
      }),
    ).toBeNull()
    expect(
      avisoDeHistoricoDoFcr({
        fcr: 90,
        fcrHistoricoDesde: '',
        periodoInicio: '2020-01-01',
      }),
    ).toBeNull()
  })
})

describe('texto do aviso — conteúdo mínimo da §4 do be-f4f5-report', () => {
  it('nomeia o indicador, a data e a direção do erro', () => {
    expect(TITULO_AVISO_FCR).toContain('FCR')
    expect(TITULO_AVISO_FCR).toContain('superestimado')

    const texto = textoDoAvisoDeHistoricoDoFcr('20/05/2026')
    expect(texto).toContain('O histórico de movimentação começa em 20/05/2026')
    expect(texto).toContain('resolvidos no primeiro contato por falta de registro')
    expect(texto).toContain('superestimado')
  })

  it('a data do texto vem do parâmetro, nunca de constante', () => {
    expect(textoDoAvisoDeHistoricoDoFcr('01/01/2020')).toContain('01/01/2020')
    expect(textoDoAvisoDeHistoricoDoFcr('01/01/2020')).not.toContain('20/05/2026')
  })
})
