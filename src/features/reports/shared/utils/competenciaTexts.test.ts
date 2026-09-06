/**
 * 123/FAT-1 — textos de competência de fatura.
 *
 * O que cada asserção existe para deixar VERMELHO (a pergunta de `rules/tests.md`):
 *
 *  1. `textoPeriodoDeConclusao` com as duas pontas → data errada, ordem trocada, formato
 *     ISO cru ou fuso deslocado (o clássico `new Date('2026-07-01')` → 30/06).
 *  2. cada ramo de ponta faltante → dizer "a partir de X" (janela aberta) onde o backend
 *     fecha a outra ponta no mês atual (`FusoSaoPaulo.Resolver:152-159`). É o único jeito de
 *     esta frase mentir sem ninguém notar, porque ela *parece* certa.
 *  3. os quatro ramos são MUTUAMENTE distintos → um `if` colapsado devolveria a mesma frase
 *     para dois estados de filtro diferentes, e o teste por conteúdo passaria em um deles.
 *  4. os textos da regra dizem "conclu…" → é a palavra que carrega a informação inteira;
 *     um texto reescrito como "no período" (a redação ANTERIOR, que é o defeito relatado)
 *     reprova aqui.
 *  5. nenhum texto afirma prazo/periodicidade ("próxima fatura", "todo mês", "em até")
 *     — AP-FRONTEND-022: por D1 a competência pode ser dali a vários meses.
 */

import { describe, expect, it } from 'vitest'
import * as moduloDeCompetencia from './competenciaTexts'
import {
  HEADER_BALDE_ANALISE,
  HEADER_BALDE_FATURADO,
  HEADER_BALDE_PLANO,
  TEXTO_APENAS_FATURA_INFO,
  TEXTO_APENAS_FATURA_LABEL,
  TEXTO_COMPETENCIA_CONSEQUENCIA,
  TEXTO_COMPETENCIA_PROJETO,
  TEXTO_COMPETENCIA_REGRA,
  TEXTO_COMPETENCIA_SEM_CONCLUSAO,
  TEXTO_COMPETENCIA_VS_SAUDE_PLANOS,
  TEXTO_DIVERGENCIA_KPI_TABELA,
  TEXTO_SAUDE_PLANOS_COMPARACAO,
  TEXTO_SAUDE_PLANOS_ROTULO,
  TOOLTIP_BALDE_ANALISE,
  TOOLTIP_BALDE_FATURADO,
  TOOLTIP_BALDE_PLANO,
  TOOLTIP_CONCLUIDO_EM,
  TOOLTIP_HORAS_ADICIONAIS,
  TOOLTIP_HORAS_ANALISE,
  TOOLTIP_HORAS_FATURAVEIS,
  TOOLTIP_HORAS_RESTANTES,
  TOOLTIP_HORAS_USADAS,
  textoPeriodoDeConclusao,
  KPI_EM_ABERTO_LABEL,
  KPI_EM_ABERTO_TEXTO,
  textoPeriodoDoDetalhe,
} from './competenciaTexts'

describe('textoPeriodoDeConclusao — as duas pontas preenchidas', () => {
  it('formata as datas em dd/MM/yyyy, na ordem de/até, sem deslocar o dia', () => {
    // Literal escrito à mão (nunca derivado da entrada): expectativa derivada seria
    // tautologia. 01/07 é justamente o dia que um `new Date(iso)` em UTC vira 30/06.
    expect(textoPeriodoDeConclusao({ from: '2026-07-01', to: '2026-07-31' })).toBe(
      'Mostrando os chamados concluídos entre 01/07/2026 e 31/07/2026.',
    )
  })

  it('a virada de ano não embaralha os dois limites', () => {
    expect(textoPeriodoDeConclusao({ from: '2025-12-31', to: '2026-01-01' })).toBe(
      'Mostrando os chamados concluídos entre 31/12/2025 e 01/01/2026.',
    )
  })
})

describe('textoPeriodoDeConclusao — ponta faltante NÃO é janela aberta', () => {
  it('só `from`: fecha no fim do mês atual, e a frase diz isso', () => {
    const texto = textoPeriodoDeConclusao({ from: '2026-07-01', to: null })
    expect(texto).toBe(
      'Mostrando os chamados concluídos de 01/07/2026 até o fim do mês atual.',
    )
    // O erro que este assert impede: "a partir de 01/07/2026", que afirma uma janela
    // aberta. `FusoSaoPaulo.Resolver:156-159` fecha a ponta ausente no último dia do mês.
    expect(texto).not.toContain('a partir de')
  })

  it('só `to`: abre no primeiro dia do mês atual, e a frase diz isso', () => {
    const texto = textoPeriodoDeConclusao({ from: null, to: '2026-07-31' })
    expect(texto).toBe(
      'Mostrando os chamados concluídos do primeiro dia do mês atual até 31/07/2026.',
    )
  })

  it('nenhuma das duas: o período é o mês atual, nunca "todos"', () => {
    const texto = textoPeriodoDeConclusao({ from: null, to: null })
    expect(texto).toBe('Sem datas preenchidas: mostrando os chamados concluídos no mês atual.')
    // "mostrando todos" seria falso: `Resolver:152-159` sempre monta uma janela.
    expect(texto).not.toContain('todos')
  })

  it('os quatro ramos produzem quatro frases distintas', () => {
    // Um `if` colapsado (ex.: tratar `from` sozinho como "sem filtro") devolveria a mesma
    // frase para dois estados diferentes, e os asserts por conteúdo acima ainda passariam
    // para o ramo sobrevivente.
    const frases = [
      textoPeriodoDeConclusao({ from: '2026-07-01', to: '2026-07-31' }),
      textoPeriodoDeConclusao({ from: '2026-07-01', to: null }),
      textoPeriodoDeConclusao({ from: null, to: '2026-07-31' }),
      textoPeriodoDeConclusao({ from: null, to: null }),
    ]
    expect(new Set(frases).size).toBe(4)
  })

  it('data ilegível cai no valor cru, sem lançar e sem "Invalid Date"', () => {
    const texto = textoPeriodoDeConclusao({ from: 'nao-e-data', to: '2026-07-31' })
    expect(texto).toContain('nao-e-data')
    expect(texto).not.toContain('Invalid')
  })
})

describe('os textos declaram POR QUAL DATA o período recorta', () => {
  /**
   * Universo NOMINAL (nunca padrão de nome): cada texto que a UI usa para explicar uma
   * coluna/cartão de horas apuradas. Todos derivam do mesmo predicado
   * (`Ticket.FechadoEm ∈ [from, to)`) e por isso todos têm de declará-lo.
   *
   * Entrada nova nesta lista responde à pergunta "esta superfície apura por conclusão?".
   * Se um dia alguma passar a apurar por outra data, ela SAI da lista no mesmo commit —
   * a saída é a declaração, não o afrouxamento do assert.
   */
  const TEXTOS_QUE_DECLARAM_CONCLUSAO: Record<string, string> = {
    TEXTO_COMPETENCIA_REGRA,
    TEXTO_COMPETENCIA_CONSEQUENCIA,
    TEXTO_COMPETENCIA_SEM_CONCLUSAO,
    TOOLTIP_HORAS_USADAS,
    TOOLTIP_HORAS_RESTANTES,
    TOOLTIP_HORAS_ADICIONAIS,
    TOOLTIP_HORAS_FATURAVEIS,
    TOOLTIP_HORAS_ANALISE,
    TOOLTIP_CONCLUIDO_EM,
    TOOLTIP_BALDE_PLANO,
    TOOLTIP_BALDE_FATURADO,
    TOOLTIP_BALDE_ANALISE,
  }

  it.each(Object.entries(TEXTOS_QUE_DECLARAM_CONCLUSAO))(
    '%s fala de conclusão do chamado',
    (_nome, texto) => {
      // Vermelho quando o texto volta a ser genérico ("no período", sem dizer qual data) —
      // que é literalmente o defeito relatado em B2.
      expect(texto.toLowerCase()).toMatch(/conclu/)
    },
  )

  it('o conjunto de textos que declaram conclusão é nominalmente este', () => {
    // Identidade, não cardinalidade: `it.each` encolhe em silêncio (menos parâmetros nunca
    // é erro para o runner — `rules/tests.md`). Aqui, tanto remover quanto renomear uma
    // entrada reprova.
    expect(new Set(Object.keys(TEXTOS_QUE_DECLARAM_CONCLUSAO))).toEqual(
      new Set([
        'TEXTO_COMPETENCIA_REGRA',
        'TEXTO_COMPETENCIA_CONSEQUENCIA',
        'TEXTO_COMPETENCIA_SEM_CONCLUSAO',
        'TOOLTIP_HORAS_USADAS',
        'TOOLTIP_HORAS_RESTANTES',
        'TOOLTIP_HORAS_ADICIONAIS',
        'TOOLTIP_HORAS_FATURAVEIS',
        'TOOLTIP_HORAS_ANALISE',
        'TOOLTIP_CONCLUIDO_EM',
        'TOOLTIP_BALDE_PLANO',
        'TOOLTIP_BALDE_FATURADO',
        'TOOLTIP_BALDE_ANALISE',
      ]),
    )
  })

  it('a exceção de PROJETO é declarada como sendo pela data do apontamento', () => {
    // `ReportQueryRepository.cs:769,786` — projeto não tem chamado, logo `InicioEm`.
    // Este é o único texto do conjunto que NÃO deve falar de conclusão.
    expect(TEXTO_COMPETENCIA_PROJETO).toContain('projeto')
    expect(TEXTO_COMPETENCIA_PROJETO).toContain('data do próprio apontamento')
  })

  it('a divergência KPI × tabela nomeia AS DUAS datas e diz que é proposital', () => {
    expect(TEXTO_DIVERGENCIA_KPI_TABELA).toContain('data de conclusão do chamado')
    expect(TEXTO_DIVERGENCIA_KPI_TABELA).toContain('data do apontamento')
    expect(TEXTO_DIVERGENCIA_KPI_TABELA).toContain('proposital')
  })
})

describe('os baldes se identificam como totais DO CHAMADO, não do período', () => {
  it.each([
    ['plano', HEADER_BALDE_PLANO, TOOLTIP_BALDE_PLANO],
    ['faturado', HEADER_BALDE_FATURADO, TOOLTIP_BALDE_FATURADO],
    ['análise', HEADER_BALDE_ANALISE, TOOLTIP_BALDE_ANALISE],
  ])('balde %s: cabeçalho marca "(chamado)" e o tooltip nega o recorte', (_n, header, tooltip) => {
    // Sem o "(chamado)" no cabeçalho, o usuário soma estas colunas com "Tempo no período",
    // que é outra janela (`ReportQueryRepository.cs:1198-1204` × `:1168-1176`).
    expect(header).toContain('(chamado)')
    expect(tooltip).toContain('sem recorte de período')
  })
})

describe('textos do toggle "só o que entra na fatura"', () => {
  it('o rótulo e a explicação descrevem OS DOIS estados do toggle', () => {
    expect(TEXTO_APENAS_FATURA_LABEL).toBe('Só o que entra na fatura do período')
    // Explicação de estado binário que só descreve um lado deixa o outro sem significado —
    // e o outro é justamente o DEFAULT.
    expect(TEXTO_APENAS_FATURA_INFO).toContain('Desligado')
    expect(TEXTO_APENAS_FATURA_INFO).toContain('Ligado')
    expect(TEXTO_APENAS_FATURA_INFO).toContain('em aberto')
  })
})

/**
 * 123/FE-FIX4 (achado `F-8`) — o universo do invariante é DERIVADO dos exports do
 * módulo, nunca mantido à mão.
 *
 * A lista `const TODOS = [...]` que morava aqui tinha **22 das 29** constantes de texto
 * exportadas. Descontando 3 aliases já cobertos pelo original, **5 textos reais de UI**
 * (`TEXTO_COMPETENCIA_TITULO`, os três `HEADER_BALDE_*` e `TEXTO_APENAS_FATURA_LABEL`)
 * ficavam **fora** dos detectores — e o próximo texto longo que nascesse sem entrar na
 * lista nasceria fora dela, em silêncio. `rules/security.md`: *nenhuma enumeração que dá
 * poder a um invariante é mantida à mão*.
 */
function textosExportados(modulo: Record<string, unknown>): { nome: string; texto: string }[] {
  return Object.entries(modulo)
    .filter((entrada): entrada is [string, string] => typeof entrada[1] === 'string')
    .map(([nome, texto]) => ({ nome, texto }))
    .sort((a, b) => a.nome.localeCompare(b.nome))
}

/**
 * Redações que afirmam prazo/periodicidade que o sistema não garante. Identidade
 * travada abaixo: `it.each` sobre uma lista encolhe em silêncio (menos parâmetros nunca
 * é erro para o runner — `rules/tests.md`).
 */
const PADROES_DE_PRAZO = [
  // "próxima fatura" é o erro concreto: por D1 a competência é a do mês em que o chamado
  // FECHAR, que pode ser dali a vários meses. Já reprovado uma vez em 121/F7.
  /pr[óo]xima fatura/i,
  /todo m[êe]s/i,
  /em at[ée] \d/i,
  /dentro de \d+ dias/i,
]

describe('nenhum texto afirma prazo ou periodicidade (AP-FRONTEND-022)', () => {
  const MODULO: Record<string, unknown> = { ...moduloDeCompetencia }
  const TODOS = textosExportados(MODULO)

  /**
   * Piso de NÃO-ENCOLHIMENTO, não universo: texto novo entra sozinho (é o objetivo da
   * derivação), mas texto que **sai** da cobertura tem de ser uma decisão declarada —
   * apagar ou renomear um export sem atualizar esta lista reprova nomeando a constante.
   */
  const PISO_DE_TEXTOS_COBERTOS = [
    'HEADER_BALDE_ANALISE',
    'HEADER_BALDE_FATURADO',
    'HEADER_BALDE_PLANO',
    'HEADER_CONCLUIDO_EM',
    'KPI_EM_ABERTO_LABEL',
    'KPI_EM_ABERTO_TEXTO',
    'TEXTO_APENAS_FATURA_INFO',
    'TEXTO_APENAS_FATURA_LABEL',
    'TEXTO_COMPETENCIA_CONSEQUENCIA',
    'TEXTO_COMPETENCIA_PROJETO',
    'TEXTO_COMPETENCIA_REGRA',
    'TEXTO_COMPETENCIA_SEM_CONCLUSAO',
    'TEXTO_COMPETENCIA_TITULO',
    'TEXTO_COMPETENCIA_VS_SAUDE_PLANOS',
    'TEXTO_DIVERGENCIA_KPI_TABELA',
    'TEXTO_SAUDE_PLANOS_COMPARACAO',
    'TEXTO_SAUDE_PLANOS_ROTULO',
    'TOOLTIP_BALDE_ANALISE',
    'TOOLTIP_BALDE_FATURADO',
    'TOOLTIP_BALDE_PLANO',
    'TOOLTIP_CONCLUIDO_EM',
    'TOOLTIP_HORAS_ADICIONAIS',
    'TOOLTIP_HORAS_ANALISE',
    'TOOLTIP_HORAS_FATURAVEIS',
    'TOOLTIP_HORAS_RESTANTES',
    'TOOLTIP_HORAS_USADAS',
    'TOOLTIP_KPI_HORAS_FATURAVEIS',
    'TOOLTIP_KPI_HORAS_RESTANTES',
    'TOOLTIP_KPI_HORAS_USADAS',
  ]

  it('o universo sai do MÓDULO (anti-vacuidade) e não encolhe em silêncio', () => {
    const nomes = TODOS.map((t) => t.nome)
    // Vazio passaria em todos os `it.each` abaixo: "nenhum infrator" seria
    // indistinguível de "não varreu nada".
    expect(nomes.length).toBeGreaterThanOrEqual(PISO_DE_TEXTOS_COBERTOS.length)
    expect(nomes).toEqual(expect.arrayContaining(PISO_DE_TEXTOS_COBERTOS))
    // Nenhum texto derivado pode vir vazio — string vazia passa em qualquer detector.
    expect(TODOS.filter((t) => t.texto.trim() === '')).toEqual([])
  })

  it('🔴 F-8: os 5 textos que a lista à mão deixava de fora agora estão cobertos', () => {
    const nomes = TODOS.map((t) => t.nome)
    expect(nomes).toEqual(
      expect.arrayContaining([
        'TEXTO_COMPETENCIA_TITULO',
        'HEADER_BALDE_PLANO',
        'HEADER_BALDE_FATURADO',
        'HEADER_BALDE_ANALISE',
        'TEXTO_APENAS_FATURA_LABEL',
      ]),
    )
  })

  it('🔴 um texto de UI NOVO entra no invariante SOZINHO (é o ponto do F-8)', () => {
    // Prova o mecanismo sobre um módulo fabricado: só o export do tipo `string` entra,
    // função e número ficam de fora, e o detector já morde o texto novo.
    const moduloFabricado: Record<string, unknown> = {
      TEXTO_NOVO_DE_UI: 'As horas entram na próxima fatura.',
      formatarAlgo: (x: string): string => x,
      LIMITE_DE_LINHAS: 5,
    }
    const derivados = textosExportados(moduloFabricado)
    expect(derivados).toEqual([
      { nome: 'TEXTO_NOVO_DE_UI', texto: 'As horas entram na próxima fatura.' },
    ])
    expect(
      PADROES_DE_PRAZO.filter((padrao) => derivados.some((d) => padrao.test(d.texto))),
    ).toHaveLength(1)
  })

  it('o conjunto de padrões proibidos é nominalmente este', () => {
    expect(PADROES_DE_PRAZO.map((p) => p.source)).toEqual([
      'pr[óo]xima fatura',
      'todo m[êe]s',
      'em at[ée] \\d',
      'dentro de \\d+ dias',
    ])
  })

  it.each(PADROES_DE_PRAZO)('nenhum texto casa %s', (padrao) => {
    // A falha NOMEIA a constante infratora — com a lista de valores crus não nomeava.
    const infratores = TODOS.filter((t) => padrao.test(t.texto)).map((t) => t.nome)
    expect(infratores).toEqual([])
  })

  it('controle positivo: o detector ainda pega uma frase infratora', () => {
    // Sem isto, um erro na regex tornaria os asserts acima vacuamente verdes.
    expect([/pr[óo]xima fatura/i].some((p) => p.test('entram na próxima fatura'))).toBe(true)
    expect(PADROES_DE_PRAZO.some((p) => p.test('a cobrança é feita todo mês'))).toBe(true)
    expect(PADROES_DE_PRAZO.some((p) => p.test('o retorno vem em até 5 dias'))).toBe(true)
    expect(PADROES_DE_PRAZO.some((p) => p.test('resolvido dentro de 10 dias'))).toBe(true)
  })
})

// ─── 123/FE-PER (D-2) — a tela DIZ qual período está mostrando ────────────────

describe('textoPeriodoDoDetalhe — imprime a janela EFETIVA', () => {
  /** Relógio fixo. Todos os literais abaixo são escritos à mão a partir dele. */
  const AGORA = new Date(2026, 8, 15, 12, 0, 0)

  it('as duas pontas preenchidas: imprime exatamente as datas do filtro', () => {
    // Vermelho com data trocada, ordem invertida, ISO cru ou off-by-one de fuso.
    expect(textoPeriodoDoDetalhe({ from: '2026-07-01', to: '2026-07-31' }, AGORA)).toBe(
      'Período em uso: 01/07/2026 a 31/07/2026. A tabela e os cartões abaixo usam este mesmo período — menos o cartão "Em aberto (não faturável ainda)", que é um total acumulado.',
    )
  })

  it('as duas em branco: imprime o mês atual E se declara padrão da tela', () => {
    // A frase que a D-2 exige. Vermelho se o default voltar a ser invisível, ou se a tela
    // passar a imprimir "—"/"sem filtro" para o estado em que ela usa o mês atual.
    expect(textoPeriodoDoDetalhe({ from: null, to: null }, AGORA)).toBe(
      'Período em uso: 01/09/2026 a 30/09/2026. A tabela e os cartões abaixo usam este mesmo período — menos o cartão "Em aberto (não faturável ainda)", que é um total acumulado. ' +
        'É o mês atual, que é o padrão da tela — troque as datas no filtro para ver outro período.',
    )
  })

  it('só o início em branco: diz de onde saiu o valor que a tela usou', () => {
    expect(textoPeriodoDoDetalhe({ from: null, to: '2026-07-31' }, AGORA)).toBe(
      'Período em uso: 01/09/2026 a 31/07/2026. A tabela e os cartões abaixo usam este mesmo período — menos o cartão "Em aberto (não faturável ainda)", que é um total acumulado. ' +
        'A data inicial ficou em branco, então vale o primeiro dia do mês atual.',
    )
  })

  it('só o fim em branco: idem, do outro lado', () => {
    expect(textoPeriodoDoDetalhe({ from: '2026-07-01', to: null }, AGORA)).toBe(
      'Período em uso: 01/07/2026 a 30/09/2026. A tabela e os cartões abaixo usam este mesmo período — menos o cartão "Em aberto (não faturável ainda)", que é um total acumulado. ' +
        'A data final ficou em branco, então vale o último dia do mês atual.',
    )
  })

  it('datas digitadas iguais ao mês atual TAMBÉM são declaradas como o mês atual', () => {
    // O estado normal do padrão é campo PREENCHIDO (a tela semeia os campos), então deduzir
    // "é o padrão" de campo em branco diria "período escolhido por você" para o default —
    // a mentira de origem da D-2. A afirmação verificável é "a janela é o mês atual".
    expect(textoPeriodoDoDetalhe({ from: '2026-09-01', to: '2026-09-30' }, AGORA)).toContain(
      'É o mês atual, que é o padrão da tela',
    )
  })

  it('os quatro estados de filtro produzem frases DISTINTAS', () => {
    // Um `if` colapsado devolveria a mesma frase para dois estados de filtro diferentes, e
    // os asserts por conteúdo passariam em um deles.
    const frases = [
      textoPeriodoDoDetalhe({ from: '2026-07-01', to: '2026-07-31' }, AGORA),
      textoPeriodoDoDetalhe({ from: null, to: null }, AGORA),
      textoPeriodoDoDetalhe({ from: null, to: '2026-07-31' }, AGORA),
      textoPeriodoDoDetalhe({ from: '2026-07-01', to: null }, AGORA),
    ]
    expect(new Set(frases).size).toBe(4)
  })

  it('mês atual em branco e mês atual digitado dão a MESMA frase — de propósito', () => {
    // A frase afirma a janela em uso, não a procedência do valor. Se um dia ela passar a
    // afirmar procedência ("você escolheu"), este teste reprova e obriga a declarar — porque
    // com os campos SEMEADOS a procedência não é observável a partir do estado.
    expect(textoPeriodoDoDetalhe({ from: null, to: null }, AGORA)).toBe(
      textoPeriodoDoDetalhe({ from: '2026-09-01', to: '2026-09-30' }, AGORA),
    )
  })

  it('nunca diz "todos" nem "sem filtro" — a tela nunca mostra o histórico inteiro', () => {
    const frases = [
      textoPeriodoDoDetalhe({ from: null, to: null }, AGORA),
      textoPeriodoDoDetalhe({ from: null, to: '2026-07-31' }, AGORA),
      textoPeriodoDoDetalhe({ from: '2026-07-01', to: null }, AGORA),
    ]
    for (const frase of frases) {
      expect(frase).not.toMatch(/todos os chamados|sem filtro|sem restri/i)
    }
    // Controle positivo do detector.
    expect(/sem filtro/i.test('mostrando sem filtro de data')).toBe(true)
  })

  it('123/FE-FIX3 (F-2): a frase EXCETUA o cartão "Em aberto", que não reage ao período', () => {
    // O QA achou as duas frases na mesma dobra: esta dizia "os cartões … usam este mesmo
    // período" e o subtexto do cartão "Em aberto" dizia "independe do período". As duas
    // verdadeiras isoladamente, contraditórias juntas.
    //
    // O que deixa isto vermelho: (a) a exceção sumir da frase; (b) o cartão ser renomeado
    // sem que a frase acompanhe — impossível por construção, já que o rótulo sai da MESMA
    // constante que o cartão renderiza, e este teste compara com a constante, não com um
    // literal repetido.
    const frases = [
      textoPeriodoDoDetalhe({ from: '2026-07-01', to: '2026-07-31' }, AGORA),
      textoPeriodoDoDetalhe({ from: null, to: null }, AGORA),
      textoPeriodoDoDetalhe({ from: null, to: '2026-07-31' }, AGORA),
      textoPeriodoDoDetalhe({ from: '2026-07-01', to: null }, AGORA),
    ]
    for (const frase of frases) {
      expect(frase).toContain(KPI_EM_ABERTO_LABEL)
      expect(frase).toContain('menos o cartão')
      // A frase antiga, sem ressalva, não pode voltar: ela é o defeito F-2.
      expect(frase).not.toContain('Os cartões e a tabela abaixo usam este mesmo período.')
    }
  })

  it('123/FE-FIX3 (F-2): as duas frases da mesma dobra deixaram de se contradizer', () => {
    // O subtexto do cartão continua dizendo que ele independe do período — e agora a frase
    // de período concorda com ele, em vez de afirmar o contrário três linhas acima.
    expect(KPI_EM_ABERTO_TEXTO).toContain('independe do período')
    const frase = textoPeriodoDoDetalhe({ from: null, to: null }, AGORA)
    // Controle: a frase nomeia o MESMO cartão de que o subtexto fala.
    expect(frase).toContain(KPI_EM_ABERTO_LABEL)
  })

  it('afirma que as DUAS metades da tela usam a mesma janela (é o requisito da D-2)', () => {
    const frases = [
      textoPeriodoDoDetalhe({ from: '2026-07-01', to: '2026-07-31' }, AGORA),
      textoPeriodoDoDetalhe({ from: null, to: null }, AGORA),
      textoPeriodoDoDetalhe({ from: null, to: '2026-07-31' }, AGORA),
      textoPeriodoDoDetalhe({ from: '2026-07-01', to: null }, AGORA),
    ]
    for (const frase of frases) {
      expect(frase).toContain('A tabela e os cartões abaixo usam este mesmo período — menos o cartão "Em aberto (não faturável ainda)", que é um total acumulado.')
    }
  })
})

// ─── 123/FE-PER (D-14 / AUTO-1) — as duas telas de consumo, rotuladas ─────────

describe('rótulos que separam o medidor ao vivo da visão de fatura', () => {
  it('Saúde dos Planos se declara AO VIVO, pela data do lançamento', () => {
    // Vermelho se o rótulo voltar a ser genérico ("consumo no período"), que é o estado em
    // que a divergência com o Consumo de Planos parece erro.
    expect(TEXTO_SAUDE_PLANOS_ROTULO).toContain('ao vivo')
    expect(TEXTO_SAUDE_PLANOS_ROTULO).toContain('o time a lançou')
  })

  it('Saúde dos Planos nomeia a OUTRA tela, a outra data, e afirma que as duas estão certas', () => {
    expect(TEXTO_SAUDE_PLANOS_COMPARACAO).toContain('Consumo de Planos')
    expect(TEXTO_SAUDE_PLANOS_COMPARACAO).toContain('chamado foi concluído')
    // Sem esta frase, "números diferentes" só tem uma leitura: o sistema está errado.
    expect(TEXTO_SAUDE_PLANOS_COMPARACAO).toContain('os dois estão certos')
  })

  it('Consumo de Planos nomeia a OUTRA tela, a outra data, e afirma o mesmo', () => {
    expect(TEXTO_COMPETENCIA_VS_SAUDE_PLANOS).toContain('Saúde dos Planos')
    expect(TEXTO_COMPETENCIA_VS_SAUDE_PLANOS).toContain('o time lançou a hora')
    expect(TEXTO_COMPETENCIA_VS_SAUDE_PLANOS).toContain('os dois estão certos')
  })

  /**
   * 123/FE-FIX3 (ressalva `F-4`) — a divergência tem DUAS causas, e o texto dizia uma.
   *
   * Conferido na fonte do backend em 05/09/2026:
   *  · `plan-consumption.HorasUsadasSeg` (`ReportQueryRepository.cs:755-770`) soma
   *    `c.Tickets…` por `Ticket.FechadoEm` **MAIS** `c.Projects…` por `te.InicioEm`;
   *  · `plan-health.HorasConsumidas` (`MetricsQueryRepository.cs:1258-1267`) soma **só**
   *    `c.Tickets…`. Não há parcela de `c.Projects`.
   *
   * Logo, para cliente com apontamento de projeto os dois números divergem **mesmo na
   * mesma data**. O que deixa estes asserts vermelhos: voltar a atribuir a divergência
   * apenas à data (o "Por isso" que fechava a causa).
   */
  it('123/FE-FIX3 (F-4): as duas frases dizem a SEGUNDA causa — as horas de projeto', () => {
    expect(TEXTO_SAUDE_PLANOS_COMPARACAO).toMatch(/horas lançadas em projetos/i)
    expect(TEXTO_SAUDE_PLANOS_COMPARACAO).toContain('que este medidor não inclui')
    expect(TEXTO_COMPETENCIA_VS_SAUDE_PLANOS).toMatch(/horas de projeto/i)
    expect(TEXTO_COMPETENCIA_VS_SAUDE_PLANOS).toContain('só as horas de chamados')
  })

  it('123/FE-FIX3 (F-4): nenhuma das duas fecha a causa numa única razão', () => {
    // "Por isso" (singular, fechando na data) era a redação do defeito; as duas passam a
    // dizer "Por essas duas razões". Vermelho se alguma voltar ao singular.
    for (const texto of [TEXTO_SAUDE_PLANOS_COMPARACAO, TEXTO_COMPETENCIA_VS_SAUDE_PLANOS]) {
      expect(texto).toContain('Por essas duas razões')
      expect(texto).not.toMatch(/\bPor isso\b/)
    }
    // Controle positivo do detector: ele ainda pega a redação antiga.
    expect(/\bPor isso\b/.test('conta pela data de conclusão. Por isso os dois divergem.')).toBe(
      true,
    )
  })

  it('as duas frases são espelho uma da outra: cada uma aponta para a tela do OUTRO lado', () => {
    // Vermelho se alguém copiar a frase de um lado para o outro (o erro natural), fazendo a
    // tela apontar para si mesma.
    expect(TEXTO_SAUDE_PLANOS_COMPARACAO).not.toContain('Saúde dos Planos')
    expect(TEXTO_COMPETENCIA_VS_SAUDE_PLANOS).not.toContain('Consumo de Planos')
  })

  it('nenhum dos três usa jargão de banco de dados', () => {
    const NOVOS = [
      TEXTO_SAUDE_PLANOS_ROTULO,
      TEXTO_SAUDE_PLANOS_COMPARACAO,
      TEXTO_COMPETENCIA_VS_SAUDE_PLANOS,
    ]
    const JARGAO = /InicioEm|FechadoEm|TimeEntry|plan-health|plan-consumption|billableOutsidePlan/i
    expect(NOVOS.filter((t) => JARGAO.test(t))).toEqual([])
    // Controle positivo: o detector ainda pega nome de campo do backend.
    expect(JARGAO.test('recorta por te.InicioEm')).toBe(true)
  })

  it('nenhum dos três chama a divergência de erro, defeito ou inconsistência', () => {
    const NOVOS = [
      TEXTO_SAUDE_PLANOS_ROTULO,
      TEXTO_SAUDE_PLANOS_COMPARACAO,
      TEXTO_COMPETENCIA_VS_SAUDE_PLANOS,
    ]
    const CULPA = /erro|defeito|inconsist|divergênc|não fecham/i
    expect(NOVOS.filter((t) => CULPA.test(t))).toEqual([])
    expect(CULPA.test('os números estão inconsistentes')).toBe(true)
  })
})
