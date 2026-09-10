import { describe, expect, it } from 'vitest'
import { getPercentClass, planConsumptionColumns } from './columns'
import { formatPercent } from '../shared/utils/formatters'
import type { PlanConsumptionItemDto } from '../shared/types/reports'

describe('getPercentClass — cor do % do plano', () => {
  it('retorna "green" quando valor < 80', () => {
    expect(getPercentClass(0)).toBe('green')
    expect(getPercentClass(50)).toBe('green')
    expect(getPercentClass(79.9)).toBe('green')
  })

  it('retorna "yellow" quando 80 <= valor < 95', () => {
    expect(getPercentClass(80)).toBe('yellow')
    expect(getPercentClass(87)).toBe('yellow')
    expect(getPercentClass(94.9)).toBe('yellow')
  })

  it('retorna "red" quando valor >= 95', () => {
    expect(getPercentClass(95)).toBe('red')
    expect(getPercentClass(100)).toBe('red')
    // pode exceder 100%
    expect(getPercentClass(120)).toBe('red')
    expect(getPercentClass(150)).toBe('red')
  })

  it('retorna "neutral" quando valor é null OU ausente (129 — a chave é omitida no wire)', () => {
    expect(getPercentClass(null)).toBe('neutral')
    // O `null` acima passa com `=== null` e com `== null`: não discrimina. O `undefined`
    // é o que prova o guard — ver `columns.wire.test.tsx` para o par completo e a
    // vítima de tabela renderizada.
    expect(getPercentClass(undefined)).toBe('neutral')
  })
})

describe('planConsumptionColumns — estrutura', () => {
  it('tem exatamente 12 colunas na ordem correta', () => {
    // 🔴 135/G1 — `qtdeTickets` entrou por ÚLTIMO, e a posição é load-bearing:
    // `columns.wire.test.tsx:26-28` endereça células por ÍNDICE (`COL_CNPJ = 0`,
    // `COL_PERCENTUAL = 8`). Inserir a coluna antes do índice 8 faria aquelas 6 asserções
    // medirem `horasAdicionais` enquanto o nome do teste continuaria dizendo "% do Plano".
    // Semântica no mesmo sentido: a contagem tem recorte próprio (PRD §2) e não pertence ao
    // bloco de horas do plano — pô-la no meio dele convida a leitura que o PRD proíbe.
    const keys = planConsumptionColumns.map((c) => c.key)
    expect(keys).toEqual([
      'cnpj',
      'nomeFantasia',
      'razaoSocial',
      'nomePlano',
      'qtdePlanoHoras',
      'horasUsadas',
      'horasRestantes',
      'horasAdicionais',
      'percentualPlano',
      'horasFaturaveis',
      'horasAnalise',
      'qtdeTickets',
    ])
  })

  it('🔴 135/G1 — o cabeçalho da coluna nova é o literal do usuário, "Qtde. Tickets"', () => {
    // Literal escrito à mão a partir do `prd.md` §1/§7 (a frase do usuário). Ele viaja para o
    // cabeçalho da tabela E para o cabeçalho do CSV/XLSX (`index.export.test.ts`), então
    // "arrumar" a grafia aqui muda o artefato que sai por e-mail.
    const col = planConsumptionColumns.find((c) => c.key === 'qtdeTickets')
    expect(col?.header).toBe('Qtde. Tickets')
  })

  it('todas as colunas são sortáveis', () => {
    planConsumptionColumns.forEach((col) => {
      expect(col.sortable).toBe(true)
    })
  })

  it('colunas numéricas têm align="right"', () => {
    // `qtdeTickets` entrou aqui no mesmo commit da coluna: a lista mais estrita é a que pega o
    // defeito (a doutrina já escrita em `:99-100` deste arquivo). Contagem é número e alinha à
    // direita — precedente `movimentacao-diaria/columns.tsx:68`.
    const rightCols = ['qtdePlanoHoras', 'horasUsadas', 'horasRestantes', 'horasAdicionais', 'percentualPlano', 'horasFaturaveis', 'horasAnalise', 'qtdeTickets']
    rightCols.forEach((key) => {
      const col = planConsumptionColumns.find((c) => c.key === key)
      expect(col?.align).toBe('right')
    })
  })

  it('colunas de texto têm align="left"', () => {
    const leftCols = ['cnpj', 'nomeFantasia', 'razaoSocial', 'nomePlano']
    leftCols.forEach((key) => {
      const col = planConsumptionColumns.find((c) => c.key === key)
      expect(col?.align).toBe('left')
    })
  })

  it('sortKeys casam com a whitelist do backend', () => {
    // 🔴 É AQUI que o vocabulário de ordenação front↔backend vive. Cada valor é literal
    // escrito à mão a partir da whitelist de `OrdenarEPaginarConsumoDePlanos`
    // (`ReportQueryRepository.cs:1107-1162`) — nunca derivado da coluna, senão o assert seria
    // tautologia. `sortBy` desconhecido NÃO dá 400: o backend cai no default
    // (`horasusadas desc`) em silêncio, então uma chave errada aqui produz uma seta que
    // reordena a tela e não reordena nada no servidor — sem erro e sem teste vermelho.
    const expectedSortKeys: Record<string, string> = {
      cnpj: 'cnpj',
      nomeFantasia: 'nomefantasia',
      razaoSocial: 'razaosocial',
      nomePlano: 'nomeplano',
      qtdePlanoHoras: 'qtdeplano',
      horasUsadas: 'horasusadas',
      horasRestantes: 'horasrestantes',
      horasAdicionais: 'horasadicionais',
      percentualPlano: 'percentual',
      horasFaturaveis: 'horasfaturaveis',
      horasAnalise: 'horasanalise',
      // 🆕 135/G1 — 12ª chave da whitelist, minúscula, servindo os dois caminhos (ao vivo e
      // snapshot) pelo mesmo método: `case "qtdetickets" =>` em `ReportQueryRepository.cs:1272`.
      qtdeTickets: 'qtdetickets',
    }
    planConsumptionColumns.forEach((col) => {
      expect(col.sortKey, `coluna ${col.key} sem sortKey esperado`).toBe(expectedSortKeys[col.key])
    })
    // Companheira positiva: sem ela, `expectedSortKeys` poderia estar vazio e o `forEach`
    // acima passaria comparando `undefined` com `undefined` se as colunas também perdessem o
    // `sortKey`. Literal escrito à mão, do lado do backend.
    expect(expectedSortKeys.qtdeTickets).toBe('qtdetickets')
    expect(planConsumptionColumns.find((c) => c.key === 'qtdeTickets')?.sortKey).toBe('qtdetickets')
  })

  it('colunas com tooltip ⓘ usam headerInfo (fora do botão de ordenação, 098 r2)', () => {
    // 🔴 132/F4b acrescentou `qtdePlanoHoras`: a coluna do plano ganhou tooltip porque o
    // crédito é por competência e o número passou a depender do período. `horasRestantes`
    // faltava nesta lista desde 123/FAT-1 (tem `headerInfo` e não era conferido aqui) —
    // incluído no mesmo commit, porque a lista mais estrita é a que pega o defeito. A
    // IDENTIDADE do conjunto é travada em `columns.competencia.test.ts`.
    // 🆕 135/G1 — `qtdeTickets` entrou: o PRD §2 exige o tooltip, porque é a única coluna
    // desta tela com recorte por data de ABERTURA. Sem ele, o usuário lê a contagem com o
    // recorte das horas e conclui que o sistema perdeu chamado.
    const tooltipCols = [
      'qtdePlanoHoras',
      'horasUsadas',
      'horasRestantes',
      'horasAdicionais',
      'horasFaturaveis',
      'horasAnalise',
      'qtdeTickets',
    ]
    tooltipCols.forEach((key) => {
      const col = planConsumptionColumns.find((c) => c.key === key)
      // O tooltip é declarado como texto em `headerInfo` — não como um
      // InfoIcon embutido em `headerNode` (que geraria <button> em <button>).
      expect(typeof col?.headerInfo).toBe('string')
      expect(col?.headerInfo?.length).toBeGreaterThan(0)
      expect(col?.headerNode).toBeUndefined()
    })
  })

  it('coluna CNPJ formata máscara corretamente', () => {
    const col = planConsumptionColumns.find((c) => c.key === 'cnpj')!
    const row = {
      clientId: 1,
      cnpj: '12345678000195',
      nomeFantasia: null,
      razaoSocial: null,
      nomePlano: null,
      qtdePlanoHoras: 0,
      horasUsadas: 0,
      horasRestantes: 0,
      horasAdicionais: 0,
      percentualPlano: null,
      horasFaturaveis: 0,
      horasAnalise: 0,
    }
    expect(col.accessor(row)).toBe('12.345.678/0001-95')
  })

  /**
   * 🔴 **132/D11 — o exemplo que o usuário escreveu à mão** (`prd.md` §5.1):
   *
   * ```
   * Support Elite   15h + 2h   2h 44m   14h 15m   0h 0m   16,08%
   * ```
   *
   * ⚠️ Os números do PRD **não fecham entre si a 17h efetivos**: `2h 44m` = 2,7333h, e
   * `17 − 2,7333` = 14,2667h → `14h 16m`, não `14h 15m`. `14h 15m` exige `horasUsadas = 2,75`
   * (= `2h 45m`). Não é defeito de ninguém: é o arredondamento do decimal real. Mas um literal
   * aritmeticamente impossível viraria requisito errado, então **as duas variantes entram**,
   * cada uma com o seu literal, e o exemplo do PRD fica citado.
   *
   * ⚠️ E o front **não calcula** `horasRestantes`/`percentualPlano`/`horasAdicionais` — ele
   * formata o que veio do wire (`shared/utils/planoEfetivo.ts`). O que se prova aqui é a
   * FORMATAÇÃO e a EXIBIÇÃO; quem prova a aritmética do plano efetivo é o backend.
   */
  describe('os números do usuário (prd.md §5.1) — literais escritos à mão', () => {
    function linha(over: Partial<PlanConsumptionItemDto> = {}): PlanConsumptionItemDto {
      return {
        clientId: 1,
        cnpj: '12345678000195',
        nomeFantasia: 'Cliente Exemplo',
        razaoSocial: 'Cliente Exemplo',
        nomePlano: 'Support Elite',
        qtdePlanoHoras: 15,
        creditoHoras: 2,
        qtdePlanoEfetivoHoras: 17,
        horasUsadas: 2.75,
        horasRestantes: 14.25,
        horasAdicionais: 0,
        percentualPlano: 16.18,
        horasFaturaveis: 0,
        horasAnalise: 0,
        ...over,
      }
    }

    function textoDa(key: string, row: PlanConsumptionItemDto): unknown {
      return planConsumptionColumns.find((c) => c.key === key)!.accessor(row)
    }

    it('variante que FECHA a 17h: 2,75 → "2h 45m" e restantes "14h 15m"', () => {
      const row = linha()
      expect(textoDa('horasUsadas', row)).toBe('2h 45m')
      expect(textoDa('horasRestantes', row)).toBe('14h 15m')
      expect(textoDa('horasAdicionais', row)).toBe('0h 0m')
      expect(textoDa('nomePlano', row)).toBe('Support Elite')
    })

    it('variante LITERAL do PRD: 2,7333 → "2h 44m", e restantes dá "14h 16m"', () => {
      // O `14h 15m` do PRD com `2h 44m` é impossível a 17h — e é por isso que este caso
      // existe: ele documenta o número real que a tela mostra com o decimal do PRD.
      const row = linha({ horasUsadas: 2.7333333, horasRestantes: 14.2666667 })
      expect(textoDa('horasUsadas', row)).toBe('2h 44m')
      expect(textoDa('horasRestantes', row)).toBe('14h 16m')
    })

    it('🔴 D21 — o compacto é SÓ da coluna do plano; as outras mantêm os minutos', () => {
      // Se alguém "unificar" o formato, `horasAdicionais` viraria "0h" e `horasUsadas` de um
      // cliente com hora cheia viraria "3h" — mudança de formato em toda a tela de fatura.
      const row = linha({ horasUsadas: 3, horasRestantes: 14, horasAdicionais: 0 })
      expect(textoDa('horasUsadas', row)).toBe('3h 0m')
      expect(textoDa('horasRestantes', row)).toBe('14h 0m')
      expect(textoDa('horasAdicionais', row)).toBe('0h 0m')
    })

    it('🔴 D21 — o `% do Plano` MANTÉM 1 casa: 16,08 → "16,1%", nunca "16,08%"', () => {
      // `formatPercent` é global (`formatters.ts:88-96`, `minimum/maximumFractionDigits: 1`):
      // trocar para 2 casas mudaria TODA porcentagem da app e colide com a demanda 134.
      // O `16,08%` do PRD é a ARITMÉTICA que o usuário validou (2,733 ÷ 17), não a
      // formatação. Este assert trava a expectativa correta antes que alguém "conserte" o
      // formatador para bater com o documento.
      expect(formatPercent(16.08)).toBe('16,1%')
      expect(formatPercent(16.18)).toBe('16,2%')
      expect(formatPercent(null)).toBe('—')
    })
  })

  it('coluna CNPJ exibe "—" quando null', () => {
    const col = planConsumptionColumns.find((c) => c.key === 'cnpj')!
    const row = {
      clientId: 1,
      cnpj: null,
      nomeFantasia: null,
      razaoSocial: null,
      nomePlano: null,
      qtdePlanoHoras: 0,
      horasUsadas: 0,
      horasRestantes: 0,
      horasAdicionais: 0,
      percentualPlano: null,
      horasFaturaveis: 0,
      horasAnalise: 0,
    }
    expect(col.accessor(row)).toBe('—')
  })
})
