/**
 * 123/FAT-1 · **invertido e apertado por 132/F3+F4b** — os `headerInfo` das colunas do Consumo
 * de Planos declaram **por qual data** o período recorta, e **qual plano** o número usa.
 *
 * Por que este arquivo existe: os tooltips diziam genericamente "no período". Quem filtrava
 * julho, via 0 h e sabia que tinha apontado 2 h em julho concluía que o sistema perdeu o dado —
 * é o relato B2 literal.
 *
 * 🔴 **132/D1 — o que INVERTEU.** A regra apurada era `Ticket.FechadoEm` e passou a ser
 * `TimeEntry.InicioEm` (região `⟪121/A1 PLANCONSUMO-TICKET⟫`,
 * `ReportQueryRepository.cs:883-943`). O assert que exigia `/conclu/` em cada tooltip passou a
 * **defender a regra revogada**: ele deixaria vermelho justamente o texto correto. Foi
 * invertido, nunca afrouxado — e ficou MAIS específico, com um padrão de declaração por coluna
 * em vez de uma palavra só para todas.
 *
 * O que deixa cada asserção VERMELHA:
 *  · revert de qualquer tooltip para a redação genérica ("no período" sem dizer qual data) →
 *    o padrão de declaração daquela coluna cai, nomeando-a;
 *  · volta da redação ANTIGA ("chamados concluídos no período") → o detector de regra revogada
 *    cai, com controle positivo ao lado provando que ele não morreu;
 *  · retorno do jargão de banco/código (`billableOutsidePlan`, `FechadoEm`, `InicioEm`,
 *    `Ticket.`) → o assert de jargão cai;
 *  · coluna apurada NOVA sem tooltip → o assert de identidade do conjunto cai, nomeando a
 *    coluna;
 *  · coluna que HOJE tem tooltip perdendo o `headerInfo` → mesmo assert.
 *
 * 🆕 **135/G1 — `qtdeTickets` ENTROU, e o padrão dela é `/abertura/`, não `/apontad/`.** Ela é
 * a única coluna desta tela cujo recorte é a data de ABERTURA do chamado; o número **não
 * explica** as horas ao lado, de propósito (PRD §2). Ela é coluna **apurada** (o valor depende
 * do período filtrado) e **tem** `headerInfo`, então sem a entrada na allowlist o assert de
 * identidade ficaria vermelho **nomeando** `qtdeTickets`. E como o padrão por coluna poderia
 * ser satisfeito por um regex frouxo, foi acrescentado o assert que prova que `/abertura/` e
 * `/apontad/` **discriminam** conjuntos nominais distintos.
 */

import { describe, expect, it } from 'vitest'
import { planConsumptionColumns } from './columns'
import {
  TOOLTIP_HORAS_ADICIONAIS,
  TOOLTIP_HORAS_ANALISE,
  TOOLTIP_HORAS_FATURAVEIS,
  TOOLTIP_HORAS_RESTANTES,
  TOOLTIP_HORAS_USADAS,
  TOOLTIP_QTDE_PLANO,
  TOOLTIP_QTDE_TICKETS,
} from '../shared/utils/competenciaTexts'

/**
 * As colunas cujo valor **depende do recorte de período** — allowlist NOMINAL, item a item, com
 * a âncora do predicado e o padrão que o texto tem de declarar. Nunca padrão de nome
 * (`key.startsWith('horas')`): um `horasXpto` novo entraria na varredura só por causa do nome, e
 * um `consumoDoPlano` ficaria de fora sem nada reprovar (`rules/security.md` § "exclusão é
 * allowlist nominal").
 *
 * 🔴 **132/F4b — `qtdePlanoHoras` ENTROU, e a justificativa antiga da exclusão era o ponto.**
 * Ela dizia: *"o contratado do plano, **não depende do período**"*. Isso ficou **falso** com o
 * crédito de horas: `creditoshoras.competencia` é a competência de vigência, então o plano
 * exibido nesta coluna **muda com o período filtrado** (`ReportQueryRepository.cs:969-999`).
 * A saída correta é a coluna **entrar no invariante com a justificativa nova** — deixar a
 * exclusão com a justificativa velha faria a allowlist afirmar o que não é mais verdade
 * (`AP-QA-044`), e é justamente o que este arquivo existe para impedir.
 *
 * `declara` é o padrão que aquele tooltip **tem** de casar. Ele é por coluna, e não um
 * `/apontament/` global, porque as colunas declaram coisas diferentes: as de hora declaram a
 * DATA do recorte; a do plano declara a COMPETÊNCIA do crédito (o plano não é "apontado"). Um
 * padrão global só passaria se o texto do plano fosse redigido para agradar ao teste — que é
 * exatamente a inversão de causa que `rules/tests.md` proíbe.
 *
 * Fora da lista, e por quê (allowlist nominal também na saída):
 *  · `cnpj`/`nomeFantasia`/`razaoSocial`/`nomePlano` — cadastro do cliente; nenhum deles muda
 *    com o período (`clientQuery` os projeta direto de `Clients`, `:821-830`);
 *  · `percentualPlano` — razão entre duas colunas que já declaram o recorte, e a única sem
 *    tooltip de propósito: repetir a declaração nas duas pontas de uma divisão duplicaria o
 *    texto sem acrescentar informação. ⚠️ Ele **depende** do plano efetivo (`:1023`), e é a
 *    razão pela qual `TOOLTIP_QTDE_PLANO` cita "o percentual" nominalmente.
 */
const COLUNAS_APURADAS: Record<string, { texto: string; declara: RegExp; porque: string }> = {
  qtdePlanoHoras: {
    texto: TOOLTIP_QTDE_PLANO,
    // O plano não é "apontado": o que ele declara é de qual COMPETÊNCIA sai o crédito somado.
    declara: /compet[êe]ncia/i,
    porque:
      'plano BASE + crédito da competência (`:969-999`, `:1006-1043`) — 132/D11. Passou a ' +
      'depender do período, e é por isso que ganhou tooltip.',
  },
  horasUsadas: {
    texto: TOOLTIP_HORAS_USADAS,
    declara: /apontad/i,
    porque: '`HorasUsadasSeg`, ticket-only por `te.InicioEm` (`:900-914`).',
  },
  horasRestantes: {
    texto: TOOLTIP_HORAS_RESTANTES,
    declara: /apontad/i,
    porque: 'derivada de `horasUsadas` sobre o plano EFETIVO (`:1021`) — herda o recorte.',
  },
  horasAdicionais: {
    texto: TOOLTIP_HORAS_ADICIONAIS,
    declara: /apontad/i,
    porque: 'excedente sobre o plano EFETIVO (`:1022`) — herda o recorte.',
  },
  horasFaturaveis: {
    texto: TOOLTIP_HORAS_FATURAVEIS,
    declara: /apontad/i,
    porque: '`HorasFaturaveisSeg`, ticket + projeto por `te.InicioEm` (`:915-931`).',
  },
  horasAnalise: {
    texto: TOOLTIP_HORAS_ANALISE,
    declara: /apontad/i,
    porque: '`HorasAnaliseSeg`, ticket-only por `te.InicioEm` (`:932-942`).',
  },
  qtdeTickets: {
    texto: TOOLTIP_QTDE_TICKETS,
    // 🔴 135/G1 — o padrão é `/abertura/`, NÃO `/apontad/`: esta é a ÚNICA coluna da tela
    // cujo recorte é a data de ABERTURA do chamado. Um `/apontad/` global só passaria se o
    // texto fosse redigido para agradar ao teste — a inversão de causa que `rules/tests.md`
    // proíbe. É também a razão pela qual os dois textos da 135 NÃO entram em
    // `TEXTOS_QUE_DECLARAM_APONTAMENTO` (`competenciaTexts.test.ts`), decisão já declarada
    // nos dois lados.
    declara: /abertura/i,
    porque:
      'contagem de chamados ABERTOS no período, em qualquer status atual: `t.HsCriadoEm ∈ ' +
      '[from, toExclusive)` + `DesativadoEm IS NULL` (`135/analise-backend.md` §3.1, ' +
      '`ReportQueryRepository.cs:1172`). É coluna APURADA — o valor depende do período ' +
      'filtrado — mas com recorte PRÓPRIO: as demais contam horas apontadas (PRD §2). Em ' +
      'competência fechada vem congelada do snapshot (135/G4).',
  },
}

function headerInfoDe(key: string): string | undefined {
  return planConsumptionColumns.find((c) => c.key === key)?.headerInfo
}

describe('Consumo de Planos — as colunas apuradas declaram o recorte por apontamento', () => {
  it('o conjunto de colunas COM headerInfo é nominalmente o das colunas apuradas', () => {
    // Identidade nas duas direções, derivada da fonte real (o array de colunas):
    //  · coluna apurada nova sem tooltip → falta aqui e o teste a NOMEIA;
    //  · coluna de cadastro ganhando tooltip de competência → sobra aqui.
    // Cardinalidade sozinha passaria com uma entrando e outra saindo.
    const comTooltip = planConsumptionColumns
      .filter((c) => c.headerInfo !== undefined)
      .map((c) => c.key)
    expect(new Set(comTooltip)).toEqual(new Set(Object.keys(COLUNAS_APURADAS)))
  })

  it('a lista de apuradas é nominalmente esta — `qtdePlanoHoras` (132/F4b) e `qtdeTickets` (135/G1) DENTRO', () => {
    // Trava a identidade da própria allowlist: sem isto, "atualizar a exclusão" poderia ser
    // feito removendo uma entrada em silêncio, e a varredura encolheria sem nada reprovar.
    expect(Object.keys(COLUNAS_APURADAS).sort()).toEqual([
      'horasAdicionais',
      'horasAnalise',
      'horasFaturaveis',
      'horasRestantes',
      'horasUsadas',
      'qtdePlanoHoras',
      'qtdeTickets',
    ])
    // E toda entrada carrega justificativa escrita — allowlist sem justificativa é allowlist
    // que ninguém revisa (`rules/security.md`).
    for (const [key, entrada] of Object.entries(COLUNAS_APURADAS)) {
      expect(entrada.porque.length, `entrada ${key} sem justificativa`).toBeGreaterThan(20)
    }
  })

  it.each(Object.entries(COLUNAS_APURADAS))(
    'coluna %s usa o texto ancorado e declara o recorte',
    (key, { texto, declara }) => {
      const info = headerInfoDe(key)
      // Literal vindo do módulo de textos (que tem o próprio teste com literais escritos à
      // mão) — não é tautologia: aqui se prova o LIGAMENTO coluna↔texto, que é o elo que
      // faltava. Se a coluna voltar a ter string inline, este assert cai.
      expect(info).toBe(texto)
      expect(info, `coluna ${key} não declara ${String(declara)}`).toMatch(declara)
    },
  )

  it('🔴 135/G1 — `/abertura/` e `/apontad/` DISCRIMINAM: cada um casa um conjunto nominal', () => {
    // Sem isto, `declara: /abertura/i` na entrada de `qtdeTickets` estaria provado apenas
    // sobre o próprio texto — e um padrão que casasse tudo (ou nada) seria indistinguível de
    // um padrão correto. Aqui os dois conjuntos são varridos sobre a fonte REAL (o array de
    // colunas) e comparados com listas LITERAIS escritas à mão.
    const casam = (p: RegExp) =>
      planConsumptionColumns
        .filter((c) => c.headerInfo !== undefined && p.test(c.headerInfo))
        .map((c) => c.key)
        .sort()

    // A contagem é a ÚNICA coluna que fala de "abertura". Se outra passar a falar, o recorte
    // dela mudou (ou o texto está errado) e isto reprova nomeando-a.
    expect(casam(/abertura/i)).toEqual(['qtdeTickets'])

    // 🔴 E `qtdeTickets` NÃO está entre as que declaram apontamento — é a razão da não-entrada
    // em `TEXTOS_QUE_DECLARAM_APONTAMENTO`. Se alguém reescrever o tooltip dizendo
    // "apontadas", este assert cai: o texto passaria a afirmar o recorte ERRADO.
    expect(casam(/apontad/i)).toEqual([
      'horasAdicionais',
      'horasAnalise',
      'horasFaturaveis',
      'horasRestantes',
      'horasUsadas',
    ])
    expect(casam(/apontad/i)).not.toContain('qtdeTickets')
  })

  it('🔴 nenhum headerInfo volta a afirmar a regra REVOGADA (a data de conclusão)', () => {
    // Este é o assert que substituiu o `/conclu/` de 123/FAT-1. Ele não é o mesmo com o sinal
    // trocado: a palavra "concluído" continua LEGÍTIMA em texto que fale dos apontamentos
    // concluídos (é o status do apontamento). O que fica proibido é a frase que devolve à data
    // de conclusão o poder de decidir o período.
    const REVOGADAS = [
      /chamados conclu[íi]dos no per[íi]odo/i,
      /data de conclus[ãa]o do chamado/i,
      /plano contratado/i,
    ]
    const infratores = planConsumptionColumns
      .filter((c) => c.headerInfo && REVOGADAS.some((p) => p.test(c.headerInfo!)))
      .map((c) => c.key)
    expect(infratores).toEqual([])
  })

  it('controle positivo: o detector de regra revogada pega os textos ANTIGOS, verbatim', () => {
    // Escritos à mão a partir do `git show HEAD:` do módulo de textos. Sem isto, um erro em
    // qualquer das regex deixaria o assert acima vacuamente verde — e o caminho "natural"
    // seria reescrever o texto para agradar ao teste.
    const ANTIGOS = [
      'Horas do plano nos chamados concluídos no período. Não inclui horas marcadas para cobrar fora do plano nem horas isentas de cobrança.',
      'O que sobra do plano depois das horas dos chamados concluídos no período.',
      'Horas além do plano contratado, contando os chamados concluídos no período.',
    ]
    const REVOGADAS = [
      /chamados conclu[íi]dos no per[íi]odo/i,
      /data de conclus[ãa]o do chamado/i,
      /plano contratado/i,
    ]
    for (const antigo of ANTIGOS) {
      expect(REVOGADAS.some((p) => p.test(antigo)), antigo).toBe(true)
    }
    // E o detector DISCRIMINA: os textos novos passam. Um detector que reprovasse tudo seria
    // indistinguível de um detector correto enquanto ninguém rodasse os textos novos por ele.
    for (const { texto } of Object.values(COLUNAS_APURADAS)) {
      expect(REVOGADAS.some((p) => p.test(texto)), texto).toBe(false)
    }
  })

  it('nenhum headerInfo carrega jargão de banco ou de código', () => {
    // `billableOutsidePlan` estava literalmente no tooltip de "Horas Faturáveis" — nome de
    // propriedade do HubSpot exposto ao usuário. `FechadoEm`/`InicioEm`/`Ticket.` são nomes
    // de coluna do banco: o texto tem de dizer "data do apontamento", não a coluna.
    const jargao = [/billableOutsidePlan/i, /FechadoEm/, /InicioEm/, /Ticket\./, /TimeEntry/]
    const infratores = planConsumptionColumns
      .filter((c) => c.headerInfo && jargao.some((p) => p.test(c.headerInfo!)))
      .map((c) => c.key)
    expect(infratores).toEqual([])
  })

  it('controle positivo: o detector de jargão ainda pega o texto antigo', () => {
    // Sem isto, uma regex quebrada deixaria o assert acima vacuamente verde — e o caminho
    // "natural" seria reescrever o texto para agradar ao teste em vez de corrigir o defeito.
    const antigo = 'Horas cobradas fora do plano (billableOutsidePlan).'
    expect([/billableOutsidePlan/i].some((p) => p.test(antigo))).toBe(true)
  })

  it('a varredura não passou vazia (controle positivo do próprio detector)', () => {
    expect(planConsumptionColumns.length).toBeGreaterThan(0)
    expect(planConsumptionColumns.some((c) => c.headerInfo !== undefined)).toBe(true)
  })
})
