/**
 * 121/A2 + F-15 — constantes das duas seções e os textos que afirmam comportamento do
 * sistema (AP-FRONTEND-022: são código, e por isso testados).
 *
 * O ponto central: **as duas seções nunca dizem a mesma coisa**. A seção `anomalia`
 * pede ação; a `postergado` afirma explicitamente que não pede. Se as frases
 * convergirem, o item acionável volta a se perder no informativo — que é exatamente o
 * defeito que F-15 corrige.
 */

import { describe, expect, it } from 'vitest'
import {
  BILLING_EXCEPTIONS_TIPO_INICIAL,
  BILLING_EXCEPTIONS_TIPOS,
} from './billingExceptions'
import {
  TEXTO_SECAO_DEFINICAO,
  TEXTO_SECAO_ROTULO,
  textoContagemSecao,
  textoHorasSecao,
  textoNaoClassificados,
  textoRecorteDeAtividade,
  textoSecaoVazia,
} from './billingExceptionsTexts'

describe('seções do relatório (F-15)', () => {
  it('são exatamente duas, com estes nomes (identidade, não cardinalidade)', () => {
    expect(new Set(BILLING_EXCEPTIONS_TIPOS)).toEqual(new Set(['anomalia', 'postergado']))
  })

  it('a seção inicial é a ACIONÁVEL — abrir na informativa esconderia o que exige ação', () => {
    expect(BILLING_EXCEPTIONS_TIPO_INICIAL).toBe('anomalia')
  })

  it('cada seção tem rótulo e definição próprios, e eles não se confundem', () => {
    expect(TEXTO_SECAO_ROTULO.anomalia).toBe('Precisa ação')
    expect(TEXTO_SECAO_ROTULO.postergado).toBe('Postergado')
    expect(TEXTO_SECAO_DEFINICAO.anomalia).not.toBe(TEXTO_SECAO_DEFINICAO.postergado)
  })

  it('a definição de "anomalia" pede conferência; a de "postergado" NEGA ação', () => {
    expect(TEXTO_SECAO_DEFINICAO.anomalia).toContain('Exige conferência')
    expect(TEXTO_SECAO_DEFINICAO.postergado).toContain('Não exige ação')
    expect(TEXTO_SECAO_DEFINICAO.postergado).not.toContain('Exige conferência')
  })

  it('a definição de cada seção descreve o predicado certo', () => {
    // anomalia = estágio FECHADO sem data; postergado = ainda ABERTO.
    expect(TEXTO_SECAO_DEFINICAO.anomalia).toContain('estágio fechado')
    expect(TEXTO_SECAO_DEFINICAO.postergado).toContain('ainda abertos')
    // E o destino das horas é oposto: fora de qualquer fatura × fatura da competência
    // em que o chamado fechar.
    expect(TEXTO_SECAO_DEFINICAO.anomalia).toContain('fora de qualquer fatura')
    expect(TEXTO_SECAO_DEFINICAO.postergado).toContain(
      'competência em que o chamado for concluído',
    )
  })

  it('nenhum texto de "postergado" afirma PRAZO ("próxima fatura") — D1 não garante isso', () => {
    // As horas entram na fatura da competência em que o chamado FECHAR, que pode ser
    // dali a meses. "Próxima" é o adjetivo que passa em revisão de copy e mente.
    expect(TEXTO_SECAO_DEFINICAO.postergado).not.toMatch(/próxim/i)
    expect(textoHorasSecao('postergado', '1h 0m')).not.toMatch(/próxim/i)
    expect(textoHorasSecao('postergado', '1h 0m')).toBe(
      '1h 0m entram na fatura de quando o chamado fechar',
    )
  })
})

describe('textoRecorteDeAtividade — a frase muda com o recorte, porque a pergunta muda', () => {
  it('com período: nomeia as duas datas em dd/MM/yyyy (fuso local, sem off-by-one)', () => {
    expect(textoRecorteDeAtividade({ from: '2026-07-01', to: '2026-07-31' })).toBe(
      'Mostrando as que têm apontamento entre 01/07/2026 e 31/07/2026.',
    )
  })

  it('ignorarPeriodo vence o período informado', () => {
    expect(
      textoRecorteDeAtividade({ from: '2026-07-01', to: '2026-07-31', ignorarPeriodo: true }),
    ).toBe('Mostrando todas, sem recorte de período.')
  })

  it('sem período: diz que está mostrando todas — não afirma recorte inexistente', () => {
    expect(textoRecorteDeAtividade({ from: null, to: null })).toBe(
      'Sem período filtrado: mostrando todas.',
    )
  })

  it('só from / só to têm frases próprias', () => {
    expect(textoRecorteDeAtividade({ from: '2026-07-01', to: null })).toBe(
      'Mostrando as que têm apontamento a partir de 01/07/2026.',
    )
    expect(textoRecorteDeAtividade({ from: null, to: '2026-07-31' })).toBe(
      'Mostrando as que têm apontamento até 31/07/2026.',
    )
  })
})

describe('textoSecaoVazia — vazio é SUCESSO, e diz o que significa', () => {
  it('anomalia sem período: afirma que NADA exige conferência', () => {
    expect(textoSecaoVazia('anomalia', { from: null, to: null })).toBe(
      'Nenhum chamado exige conferência: todo chamado em estágio fechado tem data de conclusão.',
    )
  })

  it('anomalia COM período: não afirma o sistema inteiro, só o recorte', () => {
    const texto = textoSecaoVazia('anomalia', { from: '2026-07-01', to: '2026-07-31' })
    expect(texto).toBe('Nenhum chamado exige conferência no período filtrado.')
    expect(texto).toContain('no período filtrado')
  })

  it('postergado tem frase própria — nunca a de anomalia', () => {
    expect(textoSecaoVazia('postergado', { from: null, to: null })).toBe(
      'Nada foi postergado: nenhum chamado aberto com horas apontadas.',
    )
    expect(textoSecaoVazia('postergado', { from: '2026-07-01', to: '2026-07-31' })).toBe(
      'Nada foi postergado no período filtrado — nenhum chamado aberto com horas apontadas.',
    )
  })

  it('ignorarPeriodo usa a frase do conjunto inteiro mesmo com from/to preenchidos', () => {
    expect(
      textoSecaoVazia('anomalia', {
        from: '2026-07-01',
        to: '2026-07-31',
        ignorarPeriodo: true,
      }),
    ).toBe(
      'Nenhum chamado exige conferência: todo chamado em estágio fechado tem data de conclusão.',
    )
  })

  it('nenhuma frase de vazio soa como falha de carregamento', () => {
    for (const tipo of BILLING_EXCEPTIONS_TIPOS) {
      for (const recorte of [
        { from: null, to: null },
        { from: '2026-07-01', to: '2026-07-31' },
      ]) {
        const texto = textoSecaoVazia(tipo, recorte)
        expect(texto).not.toMatch(/erro|falha|não foi possível/i)
      }
    }
  })
})

describe('textoContagemSecao / textoHorasSecao', () => {
  it('singular e plural, por seção', () => {
    expect(textoContagemSecao('anomalia', 1)).toBe('1 chamado fechado sem data de conclusão')
    expect(textoContagemSecao('anomalia', 4)).toBe('4 chamados fechados sem data de conclusão')
    expect(textoContagemSecao('postergado', 1)).toBe('1 chamado ainda aberto')
    expect(textoContagemSecao('postergado', 4)).toBe('4 chamados ainda abertos')
  })

  it('o destino das horas discrimina as duas seções', () => {
    expect(textoHorasSecao('anomalia', '1h 45m')).toBe('1h 45m fora de qualquer fatura')
    expect(textoHorasSecao('postergado', '1h 45m')).toBe(
      '1h 45m entram na fatura de quando o chamado fechar',
    )
  })
})

describe('textoNaoClassificados — o ponto cego é declarado, nunca escondido', () => {
  it('AUSENTE: nota sem número (nunca "0", que afirmaria "não há nenhum")', () => {
    const texto = textoNaoClassificados(undefined)
    expect(texto).toBe(
      'Chamados cujo estágio não tem cadastro não entram nesta conferência — a contagem ainda não está disponível.',
    )
    expect(texto).not.toMatch(/\b0\b/)
  })

  it('`null` do wire é AUSENTE, igual ao undefined — nunca "null chamados…" (121/F4)', () => {
    // O que um `int?` do C# serializa. Com o guard `=== undefined` este caso caía no
    // ramo do número e a tela escrevia literalmente "null chamados não puderam ser
    // classificados…".
    const texto = textoNaoClassificados(null)
    expect(texto).toBe(
      'Chamados cujo estágio não tem cadastro não entram nesta conferência — a contagem ainda não está disponível.',
    )
    expect(texto).not.toMatch(/null/)
  })

  it('ZERO de verdade: nenhuma nota (não há ponto cego a declarar)', () => {
    expect(textoNaoClassificados(0)).toBeNull()
  })

  it('com contagem: o número aparece, com plural correto', () => {
    expect(textoNaoClassificados(1)).toBe(
      '1 chamado não pôde ser classificado (estágio sem cadastro) e não aparece em nenhuma das seções.',
    )
    expect(textoNaoClassificados(7)).toBe(
      '7 chamados não puderam ser classificados (estágio sem cadastro) e não aparecem em nenhuma das seções.',
    )
  })
})
