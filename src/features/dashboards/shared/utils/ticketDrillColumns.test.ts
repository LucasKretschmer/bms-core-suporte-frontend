/**
 * Testes de ticketDrillColumns (016 + 123/D1).
 * Verifica: colunas base presentes em todo metric; colunas específicas por metric;
 * tradução do FrSla; nenhuma coluna expõe categoria HubSpot proibida (AP-SECURITY-001);
 * e a IDENTIDADE dos `sortKey` ordenáveis por metric (123/D1 — `cliente` incluído).
 *
 * O universo de métricas é DERIVADO em runtime (`TICKET_DRILL_METRICS`), nunca uma lista
 * paralela mantida à mão: métrica nova entra em todos os laços sozinha. A identidade do
 * conjunto é travada com os nomes literais logo abaixo — cardinalidade não discrimina
 * (uma métrica entrar e outra sair passaria).
 */

import { describe, it, expect } from 'vitest'
import { ticketDrillColumns, TICKET_DRILL_METRICS } from './ticketDrillColumns'
import { CATEGORIAS_PROIBIDAS } from './kpiCatalog'
import { buildDrillExportColumns, buildDrillExportRows } from '../components/MetricDrillModal'
import { chavesDeDuracao, assertCelulasDeDuracaoSaoNumericas } from '../../../../test/duracaoExport'
import type { ExportColumn } from '../../../reports/shared/utils/exportTable'
import type { TicketMetricKey, TicketRowDto } from '../types/metrics'

const ALL_METRICS: TicketMetricKey[] = TICKET_DRILL_METRICS

/**
 * Whitelist de `sortBy` da família ticket no backend, transcrita do switch de
 * `MetricsQueryRepository.GetTicketRowsAsync` (case a case, em minúsculas). Qualquer
 * `sortKey` fora daqui é ignorado em silêncio pelo servidor (cai no default
 * `hscriadoem desc`) — o usuário clica e a ordem não muda, sem erro nenhum.
 */
const BACKEND_TICKET_SORT_WHITELIST = [
  'hubspotticketid',
  'assunto',
  'cliente',
  'owner',
  'abertoem',
  'hscriadoem',
  'fechadoem',
  'reabertoem',
  'csat',
] as const

/**
 * Identidade (nomes literais, na ordem das colunas) dos `sortKey` ordenáveis de cada
 * metric após 123/D1. Ao tornar outra coluna ordenável (ex.: `assunto`, que o backend
 * também aceita), ATUALIZE esta tabela no mesmo commit — nunca afrouxe a asserção.
 */
const SORT_KEYS_ESPERADOS: Record<TicketMetricKey, string[]> = {
  'tickets-backlog': ['hubspotticketid', 'cliente', 'hscriadoem'],
  'tickets-abertos': ['hubspotticketid', 'cliente', 'hscriadoem'],
  'tickets-resolvidos': ['hubspotticketid', 'cliente', 'hscriadoem', 'fechadoem'],
  'tickets-reabertos': ['hubspotticketid', 'cliente', 'hscriadoem', 'reabertoem'],
  'tickets-tempos': ['hubspotticketid', 'cliente'],
  'tickets-sla': ['hubspotticketid', 'cliente', 'hscriadoem'],
  // A coluna CSAT não é ordenável hoje, embora o backend aceite `csat` — fora do
  // escopo de 123/D1 (que trata só de cliente). Se for habilitada, atualize aqui.
  'tickets-csat': ['hubspotticketid', 'cliente', 'fechadoem'],
  'tickets-fcr': ['hubspotticketid', 'cliente', 'fechadoem'],
}

const BASE_ROW: TicketRowDto = {
  ticketId: 1,
  hubspotTicketId: '101',
  assunto: 'Erro',
  clienteNome: 'ACME',
  equipe: 'Suporte',
  ownerNome: 'Fulano',
  status: 'Em andamento',
  hsCriadoEm: '2026-06-10',
  fechadoEm: '2026-06-12',
  reabertoEm: '2026-06-20',
  frHoras: 2,
  frHorasUteis: 1,
  frSla: 'MET',
  resHoras: 5,
  resHorasUteis: 3,
  csat: 4.5,
  isOneTouch: true,
  hubspotUrl: null,
}

describe('ticketDrillColumns', () => {
  it('o universo de métricas da família ticket é exatamente estas 8 (identidade, não contagem)', () => {
    expect([...TICKET_DRILL_METRICS].sort()).toEqual(
      [
        'tickets-abertos',
        'tickets-backlog',
        'tickets-csat',
        'tickets-fcr',
        'tickets-reabertos',
        'tickets-resolvidos',
        'tickets-sla',
        'tickets-tempos',
      ].sort(),
    )
  })

  it('a coluna Cliente é ordenável em TODA métrica da família, com sortKey=cliente (123/D1)', () => {
    for (const metric of ALL_METRICS) {
      const cliente = ticketDrillColumns(metric).find((c) => c.key === 'clienteNome')
      expect(cliente, `metric ${metric} sem coluna de cliente`).toBeDefined()
      expect(cliente!.header).toBe('Cliente')
      // As DUAS props: a DataTable só desenha o botão com `sortable && sortKey`.
      expect(cliente!.sortable, `metric ${metric}: Cliente sem sortable`).toBe(true)
      expect(cliente!.sortKey, `metric ${metric}: sortKey de Cliente errado`).toBe('cliente')
    }
  })

  it('sortKeys ordenáveis batem com a identidade esperada por metric (123/D1)', () => {
    for (const metric of ALL_METRICS) {
      const sortKeys = ticketDrillColumns(metric)
        .filter((c) => c.sortable)
        .map((c) => c.sortKey)
      expect(sortKeys, `metric ${metric}`).toEqual(SORT_KEYS_ESPERADOS[metric])
    }
  })

  it('todo sortKey exposto está na whitelist do backend (fora dela o servidor ignora em silêncio)', () => {
    for (const metric of ALL_METRICS) {
      for (const col of ticketDrillColumns(metric)) {
        if (!col.sortable) continue
        expect(
          BACKEND_TICKET_SORT_WHITELIST as readonly string[],
          `metric ${metric}: coluna "${col.key}" com sortKey "${col.sortKey}" fora da whitelist`,
        ).toContain(col.sortKey)
      }
    }
  })

  it('coluna ordenável nunca tem sortKey vazio/ausente (canSort exige as duas props)', () => {
    for (const metric of ALL_METRICS) {
      for (const col of ticketDrillColumns(metric)) {
        if (!col.sortable) continue
        expect(Boolean(col.sortable && col.sortKey), `metric ${metric}: ${col.key}`).toBe(true)
      }
    }
  })

  it('toda métrica inclui as colunas base (ticket, assunto, cliente, equipe, status)', () => {
    for (const metric of ALL_METRICS) {
      const keys = ticketDrillColumns(metric).map((c) => c.key)
      expect(keys).toEqual(
        expect.arrayContaining([
          'hubspotTicketId',
          'assunto',
          'clienteNome',
          'equipe',
          'status',
        ]),
      )
    }
  })

  it('tickets-reabertos inclui a coluna "Reaberto em"', () => {
    const keys = ticketDrillColumns('tickets-reabertos').map((c) => c.key)
    expect(keys).toContain('reabertoEm')
  })

  it('tickets-tempos inclui as colunas de tempos', () => {
    const keys = ticketDrillColumns('tickets-tempos').map((c) => c.key)
    expect(keys).toEqual(
      expect.arrayContaining(['frHoras', 'frHorasUteis', 'resHoras', 'resHorasUteis']),
    )
  })

  it('tickets-sla inclui a coluna de SLA e traduz MET/MISSED', () => {
    const cols = ticketDrillColumns('tickets-sla')
    const slaCol = cols.find((c) => c.key === 'frSla')
    expect(slaCol).toBeDefined()
    expect(slaCol!.accessor({ ...BASE_ROW, frSla: 'MET' })).toBe('No prazo')
    expect(slaCol!.accessor({ ...BASE_ROW, frSla: 'MISSED' })).toBe('Fora do prazo')
    expect(slaCol!.accessor({ ...BASE_ROW, frSla: null })).toBe('—')
  })

  it('tickets-csat inclui CSAT e tickets-fcr inclui resolução no 1º contato', () => {
    expect(ticketDrillColumns('tickets-csat').map((c) => c.key)).toContain('csat')
    const fcrCol = ticketDrillColumns('tickets-fcr').find((c) => c.key === 'isOneTouch')
    expect(fcrCol).toBeDefined()
    expect(fcrCol!.accessor({ ...BASE_ROW, isOneTouch: true })).toBe('Sim')
    expect(fcrCol!.accessor({ ...BASE_ROW, isOneTouch: false })).toBe('Não')
    expect(fcrCol!.accessor({ ...BASE_ROW, isOneTouch: null })).toBe('—')
  })

  it('o ticket é exibido como #<hubspotTicketId> (nunca o id interno)', () => {
    const col = ticketDrillColumns('tickets-backlog').find((c) => c.key === 'hubspotTicketId')
    expect(col!.accessor(BASE_ROW)).toBe('#101')
  })

  it('nenhum header expõe categoria HubSpot proibida (AP-SECURITY-001)', () => {
    for (const metric of ALL_METRICS) {
      const headers = ticketDrillColumns(metric).map((c) => c.header.toLowerCase())
      for (const proibida of CATEGORIAS_PROIBIDAS) {
        expect(headers.some((h) => h.includes(proibida.toLowerCase()))).toBe(false)
      }
    }
  })
})


/**
 * 124/`P-7` — o VOCABULÁRIO dos cabeçalhos, que é também o do EXPORT.
 *
 * `MetricDrillModal` monta `exportCols` com `columns.map((c) => ({ header: c.header, key:
 * c.key }))` — o mesmo `header` que a tabela desenha viaja para o CSV/XLSX. É o quarto
 * lugar de `AP-FRONTEND-028`, e o mais grave: planilha errada o gestor **encaminha**.
 *
 * Antes desta unidade nenhum teste tocava estes literais: a mutação `P7-COLUNA-DRILL`
 * (restaurar `'1ª resposta (úteis)'`) ficava **verde na suíte inteira**. Isto é o conserto.
 *
 * A asserção é de IDENTIDADE (lista literal na ordem), não de presença: coluna que entre
 * ou saia reprova aqui e obriga a decisão explícita.
 */
describe('ticketDrillColumns — vocabulário "1º atendimento" nos cabeçalhos e no export (124/P-7)', () => {
  /**
   * A projecao REAL do `MetricDrillModal` — importada, nao reimplementada (134). Antes
   * disto o helper era uma copia da projecao: mudar o componente sem mudar a copia deixava
   * a docstring mentindo e o teste verde (`AP-PROCESSO-008`). Agora so existe uma fonte.
   */
  function exportCols(metric: TicketMetricKey): ExportColumn[] {
    return buildDrillExportColumns(ticketDrillColumns(metric))
  }

  it('tickets-tempos: os cabeçalhos de tempo dizem "1º atendimento"', () => {
    const headers = ticketDrillColumns('tickets-tempos').map((c) => c.header)
    expect(headers).toContain('1º atendimento (corridas)')
    expect(headers).toContain('1º atendimento (úteis)')
    // A negativa acompanhada da positiva acima, na mesma execução.
    expect(headers).not.toContain('1ª resposta (corridas)')
    expect(headers).not.toContain('1ª resposta (úteis)')
  })

  it('tickets-sla: a coluna de SLA diz "SLA 1º atendimento"', () => {
    const headers = ticketDrillColumns('tickets-sla').map((c) => c.header)
    expect(headers).toContain('SLA 1º atendimento')
    expect(headers).not.toContain('SLA 1ª resposta')
  })

  it('🔴 o EXPORT leva o cabeçalho novo — mesma projeção do MetricDrillModal', () => {
    // A `key` NÃO muda (é campo do `TicketRowDto` e chave de ordenação do backend); só o
    // que o humano lê. Par header↔key travado junto, para que trocar um sem o outro caia.
    // 134: as colunas de tempo passaram a levar `type: 'duration'` no arquivo. O objeto e
    // comparado INTEIRO (nao `objectContaining`): perder o `type` reprova aqui tambem.
    expect(exportCols('tickets-tempos')).toEqual(
      expect.arrayContaining([
        { header: '1º atendimento (corridas)', key: 'frHoras', type: 'duration' },
        { header: '1º atendimento (úteis)', key: 'frHorasUteis', type: 'duration' },
      ]),
    )
    // ...e a coluna de SLA NAO e duracao: continua sem `type` (o objeto inteiro prova).
    expect(exportCols('tickets-sla')).toEqual(
      expect.arrayContaining([{ header: 'SLA 1º atendimento', key: 'frSla' }]),
    )
  })

  it('nenhum cabeçalho de NENHUMA métrica volta a dizer "resposta" (universo derivado)', () => {
    // Universo derivado em runtime: métrica nova entra sozinha nesta varredura.
    const todos = ALL_METRICS.flatMap((m) => ticketDrillColumns(m).map((c) => c.header))
    // Controle positivo: prova que a lista não está vazia antes da negativa.
    expect(todos).toContain('1º atendimento (corridas)')
    expect(todos.filter((h) => /resposta/i.test(h))).toEqual([])
    expect(todos.filter((h) => /respondid/i.test(h))).toEqual([])
    // ...e o que mede resposta DE VERDADE não foi renomeado: o CSAT continua lá.
    expect(todos).toContain('CSAT')
  })
})

/**
 * 129 — a linha de drill como o backend a serializa: todo campo anulável do
 * `TicketRowDto` chega com a **chave ausente** (`WhenWritingNull`), não com `null`.
 * Nenhuma célula pode sair `NaN`, `undefined` ou `Invalid Date`.
 */
describe('ticketDrillColumns — chaves AUSENTES no wire (129)', () => {
  /** Só os campos NÃO anuláveis do contrato. Todo o resto: chave ausente. */
  const LINHA_SEM_CHAVES = { ticketId: 9, hubspotTicketId: '909' } as TicketRowDto

  it('o fixture realmente não tem as chaves opcionais (discriminador)', () => {
    for (const chave of ['assunto', 'frHoras', 'frSla', 'csat', 'isOneTouch', 'hsCriadoEm']) {
      expect(Object.hasOwn(LINHA_SEM_CHAVES, chave)).toBe(false)
    }
    expect(Object.hasOwn(BASE_ROW, 'frHoras')).toBe(true)
  })

  it('nenhuma célula de nenhuma métrica sai com NaN/undefined/Invalid Date', () => {
    for (const metric of ALL_METRICS) {
      for (const col of ticketDrillColumns(metric)) {
        const saida = String(col.accessor(LINHA_SEM_CHAVES) ?? '')
        expect(saida, `${metric}/${col.key}`).not.toContain('NaN')
        expect(saida, `${metric}/${col.key}`).not.toContain('undefined')
        expect(saida, `${metric}/${col.key}`).not.toContain('Invalid Date')
      }
    }
  })

  it('controle positivo: com as chaves presentes as células continuam formatando valor', () => {
    const cols = ticketDrillColumns(ALL_METRICS[0])
    const comValor = cols
      .map((c) => String(c.accessor(BASE_ROW) ?? ''))
      .filter((v) => v !== '' && v !== '—')
    expect(comValor.length).toBeGreaterThan(0)
  })
})


/**
 * 134 — as 4 colunas de tempo saem CALCULÁVEIS no arquivo, e a TELA não muda.
 *
 * O discriminador é a PRESENÇA de `durationSeconds` na `ColumnDef` — a enumeração das
 * chaves de duração é DERIVADA daí (`chavesDeDuracao`), nunca uma lista paralela
 * (`AP-QA-019`). A identidade literal do conjunto está travada abaixo: cardinalidade não
 * discrimina — uma coluna entrar e outra sair passaria.
 *
 * As colunas usam `durationCellFromHours` porque `TicketRowDto.*Horas` está em HORAS
 * decimais no wire, enquanto a célula do arquivo é sempre SEGUNDOS (análise §2.1).
 */
describe('ticketDrillColumns — export calculável de duração (134)', () => {
  const CHAVES_DE_DURACAO_DA_FAMILIA = ['frHoras', 'frHorasUteis', 'resHoras', 'resHorasUteis']

  /** A projeção REAL do modal — a mesma função que escreve o arquivo. */
  const cols = (metric: TicketMetricKey): ExportColumn[] =>
    buildDrillExportColumns(ticketDrillColumns(metric))

  it('tickets-tempos: identidade LITERAL do conjunto de colunas de duração (4)', () => {
    expect(chavesDeDuracao(cols('tickets-tempos')).sort()).toEqual(
      [...CHAVES_DE_DURACAO_DA_FAMILIA].sort(),
    )
  })

  it('no universo DERIVADO de todas as métricas, só estas 4 são duração', () => {
    const uniao = new Set(ALL_METRICS.flatMap((m) => chavesDeDuracao(cols(m))))
    // Positiva primeiro: sem ela a negativa abaixo seria satisfeita pelo vazio.
    expect([...uniao].sort()).toEqual([...CHAVES_DE_DURACAO_DA_FAMILIA].sort())
    // Nada de SLA/CSAT/FCR/data marcado como duração por engano.
    for (const chave of ['frSla', 'csat', 'isOneTouch', 'hsCriadoEm', 'fechadoEm']) {
      expect(uniao.has(chave), `"${chave}" não é duração`).toBe(false)
    }
  })

  it('métrica sem coluna de tempo não tem coluna de duração nenhuma', () => {
    // Controle positivo na MESMA execução (a métrica que tem).
    expect(chavesDeDuracao(cols('tickets-tempos')).length).toBe(4)
    for (const metric of ALL_METRICS.filter((m) => m !== 'tickets-tempos')) {
      expect(chavesDeDuracao(cols(metric)), `metric ${metric}`).toEqual([])
    }
  })

  it('🔴 a célula do arquivo é NÚMERO em segundos — literais à mão, um por coluna', () => {
    const colunas = ticketDrillColumns('tickets-tempos')
    const [linha] = buildDrillExportRows(colunas, [BASE_ROW])
    // Quantidades DIFERENTES por coluna: trocar uma chave por outra reprova.
    expect(linha.frHoras).toBe(7200) // 2 h
    expect(linha.frHorasUteis).toBe(3600) // 1 h
    expect(linha.resHoras).toBe(18000) // 5 h
    expect(linha.resHorasUteis).toBe(10800) // 3 h
    // ...e as colunas de TEXTO da mesma linha continuam saindo pelo accessor.
    expect(linha.hubspotTicketId).toBe('#101')
    expect(linha.clienteNome).toBe('ACME')
    assertCelulasDeDuracaoSaoNumericas(cols('tickets-tempos'), [linha])
  })

  it('hora fracionária arredonda ao segundo, igual ao texto da tela (2,7333333 h → 9840 s)', () => {
    const colunas = ticketDrillColumns('tickets-tempos')
    const [linha] = buildDrillExportRows(colunas, [{ ...BASE_ROW, frHoras: 2.7333333 }])
    expect(linha.frHoras).toBe(9840)
    // O MESMO instante que a tela descreve — `Math.floor` daria 9839 e divergiria.
    const colFr = colunas.find((c) => c.key === 'frHoras')!
    expect(colFr.accessor({ ...BASE_ROW, frHoras: 2.7333333 })).toBe('2h 44m')
  })

  it('🔴 ausência: `null` EXPLÍCITO e chave AUSENTE viram null (célula vazia), nunca 0', () => {
    const colunas = ticketDrillColumns('tickets-tempos')
    const [comNull] = buildDrillExportRows(colunas, [
      // `null` explícito: é o caso que discrimina `== null` de `=== undefined`
      // (AP-FRONTEND-028). Só com `undefined` as duas implementações passam.
      { ...BASE_ROW, frHoras: null, frHorasUteis: null, resHoras: null, resHorasUteis: null },
    ])
    // Companheira positiva NA MESMA execução: a linha existe e as outras células têm valor.
    expect(comNull.hubspotTicketId).toBe('#101')
    for (const chave of CHAVES_DE_DURACAO_DA_FAMILIA) {
      expect(comNull[chave], `${chave} com null explícito`).toBeNull()
    }

    // Chave AUSENTE no wire (`WhenWritingNull` do backend — 129): mesmo resultado.
    const semChaves = { ticketId: 9, hubspotTicketId: '909' } as TicketRowDto
    expect(Object.hasOwn(semChaves, 'frHoras')).toBe(false) // discriminador do fixture
    const [linhaSemChaves] = buildDrillExportRows(colunas, [semChaves])
    expect(linhaSemChaves.hubspotTicketId).toBe('#909')
    for (const chave of CHAVES_DE_DURACAO_DA_FAMILIA) {
      expect(linhaSemChaves[chave], `${chave} com chave ausente`).toBeNull()
    }
  })

  it('`0` é VALOR, não ausência: 0 h vira 0 s (companheira positiva do teste acima)', () => {
    const colunas = ticketDrillColumns('tickets-tempos')
    const [linha] = buildDrillExportRows(colunas, [{ ...BASE_ROW, frHoras: 0 }])
    expect(linha.frHoras).toBe(0)
    expect(linha.frHoras).not.toBeNull()
  })

  it('T-TELA: o accessor das 4 colunas continua exibindo "Xh Ym" (a tela NÃO muda)', () => {
    const colunas = ticketDrillColumns('tickets-tempos')
    const texto = (key: string, row: TicketRowDto) =>
      colunas.find((c) => c.key === key)!.accessor(row)
    expect(texto('frHoras', BASE_ROW)).toBe('2h 0m')
    expect(texto('frHorasUteis', BASE_ROW)).toBe('1h 0m')
    expect(texto('resHoras', BASE_ROW)).toBe('5h 0m')
    expect(texto('resHorasUteis', BASE_ROW)).toBe('3h 0m')
    // Ausência na TELA continua sendo o travessão — e não a célula vazia do arquivo.
    expect(texto('frHoras', { ...BASE_ROW, frHoras: null })).toBe('—')
    expect(texto('frHoras', { ...BASE_ROW, frHoras: 0 })).toBe('0h 0m')
  })
})
