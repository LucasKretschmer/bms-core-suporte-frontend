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
 *  6. **131 (08/09/2026)** — nenhum texto volta a afirmar que a conta do plano soma horas
 *     de projeto ("soma também as horas de projeto"), nem volta a FECHAR a enumeração de
 *     razões num número ("por essas duas razões"). O detector é derivado dos exports do
 *     módulo, com controle positivo sobre as duas frases antigas escritas verbatim.
 */

import { describe, expect, it } from 'vitest'
import * as moduloDeCompetencia from './competenciaTexts'
import {
  HEADER_BALDE_ANALISE,
  HEADER_BALDE_FATURADO,
  HEADER_BALDE_PLANO,
  TEXTO_APENAS_FATURA_INFO,
  TEXTO_APENAS_FATURA_LABEL,
  KPI_PLANO_DE_SUPORTE_LABEL,
  TEXTO_COMPETENCIA_CONSEQUENCIA,
  TEXTO_COMPETENCIA_PROJETO_CONSUMO_DE_PLANOS,
  TEXTO_COMPETENCIA_PROJETO_RELATORIO_DO_CLIENTE,
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

  /**
   * 131 — este caso era UM só e travava a frase "continua contando pela data do próprio
   * apontamento" para AS DUAS telas. Virou dois, porque a decisão do usuário de 08/09/2026
   * separou os enquadramentos: no Consumo de Planos projeto saiu da conta do plano
   * (`ReportQueryRepository.cs:771-786`), no Relatório do Cliente nada mudou
   * (`:146-179`, `:210`). Nenhum dos dois foi apagado; os dois ficaram mais específicos.
   */
  it('PROJETO no Relatório do Cliente: continua pela data do apontamento (nada mudou lá)', () => {
    // Vermelho se alguém "propagar" a 131 para o Relatório do Cliente sem decisão do
    // usuário — é número de fatura, e o backend deixou aquela query intocada.
    expect(TEXTO_COMPETENCIA_PROJETO_RELATORIO_DO_CLIENTE).toContain('projeto')
    expect(TEXTO_COMPETENCIA_PROJETO_RELATORIO_DO_CLIENTE).toContain('data do próprio apontamento')
    // Nomeia o cartão que recebe essas horas — e o nome sai da MESMA constante que o
    // cartão renderiza (`ClientReportHeader.tsx`), nunca digitado de novo.
    expect(TEXTO_COMPETENCIA_PROJETO_RELATORIO_DO_CLIENTE).toContain(
      `"${KPI_PLANO_DE_SUPORTE_LABEL}"`,
    )
  })

  it('🔴 131 — PROJETO no Consumo de Planos: NÃO conta por data nenhuma, porque não conta', () => {
    // A frase antiga ("continua contando pela data do próprio apontamento") era verdadeira
    // sobre a coluna de horas desta tela até 08/09/2026. Depois da 131 ela induz ao erro:
    // ali a hora de projeto não entra na conta do plano por data alguma.
    expect(TEXTO_COMPETENCIA_PROJETO_CONSUMO_DE_PLANOS).toContain(
      'não consome o plano de suporte',
    )
    expect(TEXTO_COMPETENCIA_PROJETO_CONSUMO_DE_PLANOS).toContain('contratado à parte')
    // O que CONTINUA valendo — e um texto que sugerisse o contrário seria pior que o antigo.
    expect(TEXTO_COMPETENCIA_PROJETO_CONSUMO_DE_PLANOS).toContain('continua registrado')
    expect(TEXTO_COMPETENCIA_PROJETO_CONSUMO_DE_PLANOS).toContain('continua faturável')
    // O cliente não some da listagem: a elegibilidade manteve o ramo de projeto
    // (`ReportQueryRepository.cs:690-692`).
    expect(TEXTO_COMPETENCIA_PROJETO_CONSUMO_DE_PLANOS).toContain('continua na lista')
  })

  it('🔴 131 — os dois textos de projeto são DIFERENTES entre si', () => {
    // Vermelho se alguém "unificar" as duas frases de novo: unificadas, uma das duas telas
    // volta a afirmar a regra da outra — que é exatamente o defeito que a 131 revelou.
    expect(TEXTO_COMPETENCIA_PROJETO_CONSUMO_DE_PLANOS).not.toBe(
      TEXTO_COMPETENCIA_PROJETO_RELATORIO_DO_CLIENTE,
    )
    // Cada uma fala do seu lado: a do relatório aponta para a outra tela pelo nome; a do
    // Consumo de Planos fala de "esta tela" e não se descreve como relatório do cliente.
    expect(TEXTO_COMPETENCIA_PROJETO_RELATORIO_DO_CLIENTE).toContain('Consumo de Planos')
    expect(TEXTO_COMPETENCIA_PROJETO_CONSUMO_DE_PLANOS).not.toContain('Consumo de Planos')
    expect(TEXTO_COMPETENCIA_PROJETO_CONSUMO_DE_PLANOS).toContain('nesta tela')
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
    'KPI_PLANO_DE_SUPORTE_LABEL',
    'TEXTO_COMPETENCIA_CONSEQUENCIA',
    // 131: `TEXTO_COMPETENCIA_PROJETO` (singular) virou DOIS textos, um por tela. A troca
    // é declarada aqui de propósito — é para isso que este piso existe.
    'TEXTO_COMPETENCIA_PROJETO_CONSUMO_DE_PLANOS',
    'TEXTO_COMPETENCIA_PROJETO_RELATORIO_DO_CLIENTE',
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
   * 🔴 131 (08/09/2026) — este bloco INVERTE o que a 123/FE-FIX3 (`F-4`) travava.
   *
   * A `F-4` obrigava as duas frases a dizerem que o Consumo de Planos "soma também as
   * horas de projeto". A decisão do usuário tirou o apontamento de projeto da conta do
   * plano, e conferido na fonte em 08/09/2026:
   *  · `plan-consumption.HorasUsadasSeg` (`ReportQueryRepository.cs:777-785`) é
   *    TICKET-ONLY, como `plan-health.HorasConsumidas` (`MetricsQueryRepository.cs:1465-1474`)
   *    sempre foi — logo projeto deixou de ser diferença entre as duas telas;
   *  · **a data PERMANECE**: `te.InicioEm` (`:1465-1473`) × `Ticket.FechadoEm` (`:777-785`);
   *  · **e há uma terceira razão, que nenhum texto jamais mencionou**: o `plan-health` só
   *    considera cliente COM plano (`c.SupportPlanId != null`, `:1459`), enquanto o
   *    `plan-consumption` também lista cliente SEM plano com consumo real (`:683-693`).
   *
   * Estes testes não foram apagados: passaram a afirmar a redação nova e ficaram MAIS
   * específicos (a razão que permanece, a que sumiu, e a que nunca foi dita).
   */
  it('🔴 131: as duas frases mantêm a razão que PERMANECE — a data', () => {
    expect(TEXTO_SAUDE_PLANOS_COMPARACAO).toContain('data em que o chamado foi concluído')
    expect(TEXTO_SAUDE_PLANOS_COMPARACAO).toContain('data em que o time lançou a hora')
    expect(TEXTO_COMPETENCIA_VS_SAUDE_PLANOS).toContain('data em que o time lançou a hora')
    expect(TEXTO_COMPETENCIA_VS_SAUDE_PLANOS).toContain('data em que o chamado foi concluído')
  })

  it('🔴 131: as duas frases dizem a TERCEIRA razão — quem entra na lista', () => {
    // Sempre existiu e nunca foi dita: `plan-health` só lista cliente com plano
    // (`MetricsQueryRepository.cs:1459`).
    expect(TEXTO_SAUDE_PLANOS_COMPARACAO).toContain('lista também cliente sem plano contratado')
    expect(TEXTO_SAUDE_PLANOS_COMPARACAO).toContain('só quem tem plano')
    expect(TEXTO_COMPETENCIA_VS_SAUDE_PLANOS).toContain('só clientes com plano contratado')
    expect(TEXTO_COMPETENCIA_VS_SAUDE_PLANOS).toContain('lista também cliente sem plano')
  })

  it('🔴 131: as duas frases afirmam que projeto NÃO consome plano em nenhuma das telas', () => {
    // A razão que SUMIU vira afirmação positiva — dizer "o outro não inclui projeto" agora
    // seria falso nos dois sentidos.
    expect(TEXTO_SAUDE_PLANOS_COMPARACAO).toContain(
      'Hora de projeto não consome plano em nenhum dos dois',
    )
    expect(TEXTO_COMPETENCIA_VS_SAUDE_PLANOS).toContain(
      'Nenhum dos dois conta hora de projeto no plano',
    )
    // ⚠️ E nenhuma delas insinua que projeto deixou de ser cobrado: ele continua
    // registrado e continua faturável (`ReportQueryRepository.cs:797-803`).
    expect(TEXTO_SAUDE_PLANOS_COMPARACAO).toContain('continua registrado e faturável')
  })

  it('🔴 131: nenhuma das duas FECHA a enumeração de razões num número', () => {
    // "Por essas duas razões" (a redação da F-4) e "Por isso" (a anterior a ela) são as
    // duas formas de afirmar que a lista de causas está completa. Ela não está: além da
    // data e de quem entra na lista, o Consumo de Planos ainda estreita por equipe para o
    // atendente (`ReportQueryRepository.cs:712-719`), e o plan-health é sempre global
    // (`MetricsQueryRepository.cs:1454`). Foi um número fechado que ficou falso quando uma
    // das razões sumiu — não repetir o erro é o ponto desta unidade.
    for (const texto of [TEXTO_SAUDE_PLANOS_COMPARACAO, TEXTO_COMPETENCIA_VS_SAUDE_PLANOS]) {
      expect(texto).toContain('Por diferenças como essas')
      expect(texto).not.toContain('Por essas duas razões')
      expect(texto).not.toMatch(/\bPor isso\b/)
    }
    // Controles positivos dos DOIS detectores: eles ainda pegam as duas redações antigas.
    expect(/\bPor isso\b/.test('conta pela data de conclusão. Por isso os dois divergem.')).toBe(
      true,
    )
    expect(
      'e soma também as horas de projeto. Por essas duas razões os dois divergem.'.includes(
        'Por essas duas razões',
      ),
    ).toBe(true)
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


// ─── 131 (08/09/2026) — projeto NÃO consome plano de suporte ──────────────────

/**
 * Afirmações que a decisão do usuário de 08/09/2026 **revogou**, e que a suíte passa a
 * impedir de voltar — em QUALQUER texto exportado pelo módulo, não só nas duas frases onde
 * elas moravam. O universo é derivado dos exports (`textosExportados`), nunca mantido à
 * mão: texto novo entra sozinho no detector (`rules/security.md`).
 *
 * As duas primeiras são as frases removidas, **verbatim**. A terceira é o vício de forma
 * que as sustentava: fechar a enumeração de razões num número. Foi ele que transformou uma
 * frase verdadeira em falsa quando UMA das razões deixou de existir.
 */
const AFIRMACOES_REVOGADAS_PELA_131 = [
  // Estava em `TEXTO_COMPETENCIA_VS_SAUDE_PLANOS` (lado Consumo de Planos).
  /soma também as horas de projeto/i,
  // Estava em `TEXTO_SAUDE_PLANOS_COMPARACAO` (lado painel).
  /soma também as horas lançadas em projetos/i,
  // A forma que fecha a lista de causas.
  /Por essas duas razões/i,
]

describe('🔴 131: nenhum texto reafirma que a conta do plano soma horas de projeto', () => {
  const MODULO_131: Record<string, unknown> = { ...moduloDeCompetencia }
  const TODOS_131 = textosExportados(MODULO_131)

  it('o universo é derivado do módulo e não está vazio (anti-vacuidade)', () => {
    // Universo vazio deixaria todos os asserts abaixo vacuamente verdes — que é como um
    // detector morre em silêncio.
    expect(TODOS_131.length).toBeGreaterThanOrEqual(29)
    expect(TODOS_131.map((t) => t.nome)).toEqual(
      expect.arrayContaining([
        'TEXTO_COMPETENCIA_PROJETO_CONSUMO_DE_PLANOS',
        'TEXTO_COMPETENCIA_PROJETO_RELATORIO_DO_CLIENTE',
        'TEXTO_COMPETENCIA_VS_SAUDE_PLANOS',
        'TEXTO_SAUDE_PLANOS_COMPARACAO',
      ]),
    )
  })

  it('o conjunto de afirmações revogadas é nominalmente este', () => {
    // Identidade, não cardinalidade: `it.each` sobre lista encolhe em silêncio.
    expect(AFIRMACOES_REVOGADAS_PELA_131.map((p) => p.source)).toEqual([
      'soma também as horas de projeto',
      'soma também as horas lançadas em projetos',
      'Por essas duas razões',
    ])
  })

  it.each(AFIRMACOES_REVOGADAS_PELA_131)('nenhum texto casa %s', (padrao) => {
    // A falha NOMEIA a constante infratora.
    const infratores = TODOS_131.filter((t) => padrao.test(t.texto)).map((t) => t.nome)
    expect(infratores).toEqual([])
  })

  it('controle positivo: os detectores ainda pegam as DUAS frases antigas, verbatim', () => {
    // Escritas à mão a partir do `git show HEAD:` do arquivo — sem isto, um erro de digitação
    // numa das regex tornaria os asserts acima vacuamente verdes.
    const ANTIGA_CONSUMO_DE_PLANOS =
      'O gráfico Saúde dos Planos, no painel, conta pela data em que o time lançou a hora, para acompanhar o plano ao vivo, e considera só as horas de chamados, enquanto esta tela soma também as horas de projeto. Por essas duas razões ele pode mostrar um número diferente do desta tela no mesmo mês — e os dois estão certos.'
    const ANTIGA_SAUDE_PLANOS =
      'O relatório Consumo de Planos conta pela data em que o chamado foi concluído, que é a regra da fatura, e soma também as horas lançadas em projetos, que este medidor não inclui. Por essas duas razões os dois podem mostrar números diferentes no mesmo mês — e os dois estão certos.'

    for (const antiga of [ANTIGA_CONSUMO_DE_PLANOS, ANTIGA_SAUDE_PLANOS]) {
      expect(AFIRMACOES_REVOGADAS_PELA_131.some((p) => p.test(antiga))).toBe(true)
    }
    // Cada padrão morde ao menos uma das duas — nenhum é decorativo.
    expect(
      AFIRMACOES_REVOGADAS_PELA_131.filter((p) =>
        [ANTIGA_CONSUMO_DE_PLANOS, ANTIGA_SAUDE_PLANOS].some((a) => p.test(a)),
      ),
    ).toHaveLength(AFIRMACOES_REVOGADAS_PELA_131.length)
    // E as frases NOVAS passam — o detector discrimina, não reprova tudo.
    expect(
      AFIRMACOES_REVOGADAS_PELA_131.some((p) => p.test(TEXTO_COMPETENCIA_VS_SAUDE_PLANOS)),
    ).toBe(false)
    expect(
      AFIRMACOES_REVOGADAS_PELA_131.some((p) => p.test(TEXTO_SAUDE_PLANOS_COMPARACAO)),
    ).toBe(false)
  })
})

/**
 * ⚠️ O risco de redação do outro lado: um texto que dê a entender que projeto "não é mais
 * cobrado" seria PIOR que o texto antigo. Projeto continua registrado e continua faturável
 * — a parcela de projeto de `HorasFaturaveisSeg` segue na query
 * (`ReportQueryRepository.cs:797-803`), e o Relatório do Cliente não mudou em nada.
 *
 * O recorte é nominal (não "todo texto que fala de projeto", que seria regra sobre como o
 * nome se parece): são os quatro textos que a 131 escreveu ou reescreveu.
 */
const TEXTOS_QUE_FALAM_DE_PROJETO: Record<string, string> = {
  TEXTO_COMPETENCIA_PROJETO_CONSUMO_DE_PLANOS,
  TEXTO_COMPETENCIA_PROJETO_RELATORIO_DO_CLIENTE,
  TEXTO_COMPETENCIA_VS_SAUDE_PLANOS,
  TEXTO_SAUDE_PLANOS_COMPARACAO,
}

const SUGESTOES_DE_QUE_PROJETO_NAO_E_COBRADO = [
  /não é mais cobrad/i,
  /deixou de ser (cobrad|faturad)/i,
  /não é faturáve/i,
  /deixa de ser cobrad/i,
]

describe('🔴 131: nenhum texto sugere que projeto deixou de ser cobrado', () => {
  it('o conjunto de textos vigiados é nominalmente este', () => {
    expect(new Set(Object.keys(TEXTOS_QUE_FALAM_DE_PROJETO))).toEqual(
      new Set([
        'TEXTO_COMPETENCIA_PROJETO_CONSUMO_DE_PLANOS',
        'TEXTO_COMPETENCIA_PROJETO_RELATORIO_DO_CLIENTE',
        'TEXTO_COMPETENCIA_VS_SAUDE_PLANOS',
        'TEXTO_SAUDE_PLANOS_COMPARACAO',
      ]),
    )
  })

  it.each(Object.entries(TEXTOS_QUE_FALAM_DE_PROJETO))(
    '%s não insinua que projeto saiu da cobrança',
    (_nome, texto) => {
      expect(SUGESTOES_DE_QUE_PROJETO_NAO_E_COBRADO.filter((p) => p.test(texto))).toEqual([])
    },
  )

  it('controle positivo: o detector pega a redação perigosa', () => {
    expect(
      SUGESTOES_DE_QUE_PROJETO_NAO_E_COBRADO.some((p) =>
        p.test('a partir de agora a hora de projeto não é mais cobrada do cliente'),
      ),
    ).toBe(true)
    expect(
      SUGESTOES_DE_QUE_PROJETO_NAO_E_COBRADO.some((p) =>
        p.test('o apontamento de projeto deixou de ser faturado'),
      ),
    ).toBe(true)
  })
})
