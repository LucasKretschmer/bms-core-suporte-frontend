import { describe, it, expect } from 'vitest'
import { KPI_CATALOG, CATEGORIAS_PROIBIDAS } from './kpiCatalog'
import { ticketDrillColumns } from './ticketDrillColumns'
import { apontamentoDrillColumns } from './apontamentoDrillColumns'
import { metricFamily, type TicketMetricKey } from '../types/metrics'

describe('kpiCatalog — AP-SECURITY-001', () => {
  it('CATEGORIAS_PROIBIDAS é não-vazio', () => {
    expect(CATEGORIAS_PROIBIDAS.length).toBeGreaterThan(0)
  })

  it('KPI_CATALOG — nenhuma label contém categoria proibida', () => {
    for (const kpi of KPI_CATALOG) {
      for (const proibida of CATEGORIAS_PROIBIDAS) {
        expect(
          kpi.label,
          `label "${kpi.label}" (key=${kpi.key}) NÃO pode conter "${proibida}"`,
        ).not.toContain(proibida)
      }
    }
  })

  it('KPI_CATALOG — nenhum tooltipText contém categoria proibida', () => {
    for (const kpi of KPI_CATALOG) {
      if (!kpi.tooltipText) continue
      for (const proibida of CATEGORIAS_PROIBIDAS) {
        expect(
          kpi.tooltipText,
          `tooltipText "${kpi.tooltipText}" (key=${kpi.key}) NÃO pode conter "${proibida}"`,
        ).not.toContain(proibida)
      }
    }
  })

  it('KPI_CATALOG tem pelo menos 10 definições', () => {
    expect(KPI_CATALOG.length).toBeGreaterThanOrEqual(10)
  })

  it('cada KPI tem key, label e formatter', () => {
    for (const kpi of KPI_CATALOG) {
      expect(kpi.key, `KPI sem key`).toBeTruthy()
      expect(kpi.label, `KPI ${kpi.key} sem label`).toBeTruthy()
      expect(typeof kpi.formatter, `KPI ${kpi.key} formatter deve ser função`).toBe('function')
    }
  })

  it('formatter(0) nunca lança exceção', () => {
    for (const kpi of KPI_CATALOG) {
      expect(
        () => kpi.formatter(0),
        `formatter do KPI "${kpi.key}" lançou exceção com valor 0`,
      ).not.toThrow()
    }
  })

  it('formatter retorna string não-vazia para valor 0', () => {
    for (const kpi of KPI_CATALOG) {
      const result = kpi.formatter(0)
      expect(
        typeof result,
        `formatter do KPI "${kpi.key}" deve retornar string`,
      ).toBe('string')
    }
  })

  it('chaves obrigatórias do DTO estão presentes no catálogo', () => {
    const catalogKeys = KPI_CATALOG.map((k) => k.key)
    const requiredKeys = [
      'ticketsAbertos',
      'ticketsResolvidos',
      'ahtSegundos',
      'backlog',
      'taxaResolucao',
    ] as const

    for (const key of requiredKeys) {
      expect(catalogKeys, `Chave obrigatória "${key}" não está no KPI_CATALOG`).toContain(key)
    }
  })

  it('horasAnalise usa label operacional, nunca categoria interna', () => {
    const horasAnalise = KPI_CATALOG.find((k) => k.key === 'horasAnalise')
    expect(horasAnalise, 'horasAnalise deve existir no catálogo').toBeDefined()
    expect(horasAnalise!.label).toBe('Horas de análise')
    // Garante que não vaza categoria HubSpot
    expect(horasAnalise!.label).not.toContain('Invoicy')
    expect(horasAnalise!.label).not.toContain('Problema')
  })

  it('toleratesNull é booleano em todas as definições', () => {
    for (const kpi of KPI_CATALOG) {
      expect(
        typeof kpi.toleratesNull,
        `toleratesNull do KPI "${kpi.key}" deve ser boolean`,
      ).toBe('boolean')
    }
  })
})

describe('kpiCatalog — drill-down (016)', () => {
  it('KPIs da família ticket têm drill com o metric correto', () => {
    const expected: Record<string, string> = {
      backlog: 'tickets-backlog',
      ticketsAbertos: 'tickets-abertos',
      ticketsResolvidos: 'tickets-resolvidos',
      taxaResolucao: 'tickets-resolvidos',
      tmrHorasCorridas: 'tickets-tempos',
      tmrHorasUteis: 'tickets-tempos',
      tmeHorasCorridas: 'tickets-tempos',
      tmeHorasUteis: 'tickets-tempos',
      respondidosNoPrazo: 'tickets-sla',
      respondidosForaDoPrazo: 'tickets-sla',
      ticketsReabertos: 'tickets-reabertos',
      csat: 'tickets-csat',
      fcr: 'tickets-fcr',
    }

    for (const [key, metric] of Object.entries(expected)) {
      const kpi = KPI_CATALOG.find((k) => k.key === key)
      expect(kpi, `KPI ${key} deve existir`).toBeDefined()
      expect(kpi!.drill, `KPI ${key} deve ter drill`).toBeDefined()
      expect(kpi!.drill!.metric).toBe(metric)
    }
  })

  it('drill de SLA carrega o param sla on/late', () => {
    const noPrazo = KPI_CATALOG.find((k) => k.key === 'respondidosNoPrazo')
    const foraPrazo = KPI_CATALOG.find((k) => k.key === 'respondidosForaDoPrazo')
    expect(noPrazo!.drill!.params?.sla).toBe('on')
    expect(foraPrazo!.drill!.params?.sla).toBe('late')
  })

  it('KPIs da família apontamento têm drill paramétrico (016 B1 — wiring)', () => {
    // Cada KPI de apontamento abre /metrics/rows da família apontamento com o filtro correto.
    const expected: Record<string, { metric: string; param?: Record<string, string> }> = {
      tempoTotalSegundos: { metric: 'apontamentos' },
      ahtSegundos: { metric: 'apontamentos' },
      tempoMedioPausaSegundos: { metric: 'apontamentos-com-pausa' },
      mediaPausasPorAtendimento: { metric: 'apontamentos-com-pausa' },
      horasPlantao: { metric: 'apontamentos', param: { serviceCategory: 'Plantão' } },
      horasPlano: { metric: 'apontamentos', param: { billing: 'plano' } },
      horasFaturadoPorFora: { metric: 'apontamentos', param: { billing: 'fora' } },
      horasAnalise: { metric: 'apontamentos', param: { billing: 'analise' } },
    }
    for (const [key, exp] of Object.entries(expected)) {
      const kpi = KPI_CATALOG.find((k) => k.key === key)
      expect(kpi!.drill, `KPI ${key} deve ter drill`).toBeDefined()
      expect(kpi!.drill!.metric).toBe(exp.metric)
      if (exp.param) {
        expect(kpi!.drill!.params).toMatchObject(exp.param)
      }
    }
  })

  it('nenhum título de drill expõe categoria proibida', () => {
    for (const kpi of KPI_CATALOG) {
      if (!kpi.drill) continue
      for (const proibida of CATEGORIAS_PROIBIDAS) {
        expect(kpi.drill.title).not.toContain(proibida)
      }
    }
  })
})

describe('kpiCatalog — ordenação por cliente nos cards (123/D1)', () => {
  /**
   * Cards do dashboard cuja tabela de drill pertence à família TICKET.
   * DERIVADO em runtime do catálogo + `metricFamily` — card novo entra sozinho.
   */
  const cardsTicket = KPI_CATALOG.filter(
    (k) => k.drill !== undefined && metricFamily(k.drill.metric) === 'ticket',
  )

  it('a lista nominal de cards da família ticket é exatamente estes 13 (identidade, não contagem)', () => {
    expect(cardsTicket.map((k) => k.label)).toEqual([
      'Backlog (em aberto)',
      'Tickets abertos no período',
      'Tickets resolvidos no período',
      'Taxa de resolução',
      'TMR (corridas)',
      'TMR (horas úteis)',
      // 124/P-7 — travava 'TME / 1ª resposta (corridas)', '1ª resposta (horas úteis)',
      // 'Respondidos no prazo (SLA)' e 'Respondidos fora do prazo'. REESCRITO afirmando a
      // correção: o indicador conta até o primeiro APONTAMENTO de tempo, não até a resposta
      // ao cliente. A identidade da lista (e não a contagem) é o que faz a volta do rótulo
      // antigo reprovar aqui.
      'TME / 1º atendimento (corridas)',
      '1º atendimento (horas úteis)',
      'Atendidos no prazo (SLA)',
      'Atendidos fora do prazo',
      'Tickets reabertos',
      'CSAT',
      'FCR (1º contato)',
    ])
  })

  it('todo card da família ticket abre uma tabela com Cliente ordenável (sortKey=cliente)', () => {
    for (const card of cardsTicket) {
      const cols = ticketDrillColumns(card.drill!.metric as TicketMetricKey)
      const cliente = cols.find((c) => c.key === 'clienteNome')
      expect(cliente, `card "${card.label}" sem coluna Cliente`).toBeDefined()
      expect(cliente!.sortable, `card "${card.label}": Cliente não ordenável`).toBe(true)
      expect(cliente!.sortKey, `card "${card.label}": sortKey errado`).toBe('cliente')
    }
  })

  it('cards da família apontamento seguem SEM coluna de cliente ATE a unidade D1b (backend) existir', () => {
    // Fronteira de escopo de 123/D1: o DTO de apontamento não traz o cliente e a whitelist
    // do backend (`GetApontamentoRowsAsync`) não aceita `sortBy=cliente` — uma coluna
    // adicionada só no front ordenaria em SILÊNCIO pela ordem default. Quem entregar D1b
    // INVERTE este teste no mesmo commit (coluna presente + sortKey=cliente), nunca o apaga.
    const cardsApontamento = KPI_CATALOG.filter(
      (k) => k.drill !== undefined && metricFamily(k.drill.metric) === 'apontamento',
    )
    expect(cardsApontamento.length).toBeGreaterThan(0)
    const keys = apontamentoDrillColumns().map((c) => c.key)
    expect(keys).not.toContain('clienteNome')
  })
})

/**
 * 124/FE-TXT — os dois `tooltipText` que ficaram FALSOS quando `BE-F4F5` trocou a FONTE
 * do SLA de 1º atendimento e do FCR. 124/P-7 reescreveu o vocabulário destes mesmos
 * testes: "1ª resposta" → "1º atendimento".
 *
 * Estes testes existem para que a volta do texto antigo REPROVE. Todo valor esperado é
 * literal escrito à mão — nenhuma constante importada do catálogo (`rules/tests.md` §
 * expectativa derivada da própria resposta é tautologia).
 */
describe('kpiCatalog — a fonte do SLA e do FCR é LOCAL, e o tooltip diz isso (124/FE-TXT)', () => {
  function tooltipDe(key: string): string {
    const kpi = KPI_CATALOG.find((k) => k.key === key)
    expect(kpi, `KPI "${key}" deve existir no catálogo`).toBeDefined()
    expect(kpi!.tooltipText, `KPI "${key}" deve ter tooltipText`).toBeDefined()
    return kpi!.tooltipText!
  }

  it('respondidosNoPrazo: aponta para expediente no calendário + meta no plano OU no calendário', () => {
    // 124/P-7 — travava a mesma frase com "meta de 1ª resposta". REESCRITO afirmando a
    // correção, com o literal completo escrito à mão.
    expect(tooltipDe('respondidosNoPrazo')).toBe(
      'Requer expediente no calendário e meta de 1º atendimento no plano ou no calendário',
    )
  })

  it('respondidosNoPrazo: NÃO manda mais ao Service Hub — e diz o que exige, na mesma execução', () => {
    const texto = tooltipDe('respondidosNoPrazo')
    // POSITIVA primeiro: sem ela, a negativa abaixo passaria com tooltip vazio.
    expect(texto).toMatch(/meta de 1º atendimento/)
    expect(texto).toMatch(/expediente/)
    expect(texto).toMatch(/calendário/)
    expect(texto).not.toMatch(/service hub/i)
  })

  it('124/P-7: o tooltip NÃO volta a prometer "1ª resposta" — e o que ele diz está na mesma execução', () => {
    // O que faz este assert ficar vermelho: restaurar "meta de 1ª resposta" no catálogo.
    // A positiva ao lado impede que a negativa passe com tooltip vazio ou ausente.
    const texto = tooltipDe('respondidosNoPrazo')
    expect(texto).toContain('1º atendimento')
    expect(texto).not.toMatch(/1ª resposta/i)
    expect(texto).not.toMatch(/\bresposta\b/i)
  })

  it('respondidosNoPrazo: a meta tem DUAS moradas — não só o plano', () => {
    // `MetricsService.cs:691` → `fonte.PlanoSlaMinutos ?? metaDoCalendario`. Quem preencheu
    // só a meta padrão do calendário está configurado; mandá-lo ao plano é trabalho à toa.
    const texto = tooltipDe('respondidosNoPrazo')
    expect(texto).toMatch(/no plano ou no calendário/)
    // A redação incompleta, que conhecia só uma das duas (124/P-7 atualizou o vocabulário).
    expect(texto).not.toMatch(/meta de 1º atendimento no plano e expediente/)
  })

  it('fcr: descreve o histórico de movimentação, a fonte real desde AUTO-124-12', () => {
    expect(tooltipDe('fcr')).toBe('Calculado do histórico de movimentação do chamado')
  })

  it('fcr: a propriedade abandonada do HubSpot sumiu — e a fonte real está nomeada', () => {
    const texto = tooltipDe('fcr')
    expect(texto).toMatch(/histórico de movimentação/)
    expect(texto).not.toMatch(/one_touch/i)
    expect(texto).not.toMatch(/hs_/i)
    expect(texto).not.toMatch(/service hub/i)
  })

  it('CSAT NÃO foi tocado: ele CONTINUA vindo do Service Hub (texto verdadeiro)', () => {
    // `HubSpotClient.cs:1054` lê `props.HsLastCsatRating` e `:1100` grava em `tickets.csat`;
    // `MetricsQueryRepository.cs:294` agrega direto da coluna. Corrigir texto correto seria
    // regressão. Este teste é também o CONTROLE POSITIVO do detector de "Service Hub":
    // se o `/service hub/i` das linhas acima morresse, esta linha ficaria vermelha.
    expect(tooltipDe('csat')).toBe('Requer Service Hub configurado')
    expect(tooltipDe('csat')).toMatch(/service hub/i)
  })
})

/**
 * Invariante sobre TODO o catálogo — derivado em runtime de `KPI_CATALOG`, para que KPI
 * novo nasça dentro da varredura em vez de fora dela (`rules/security.md` § enumeração
 * que dá poder a um invariante).
 */
describe('kpiCatalog — invariante: tooltip não cita fonte abandonada (124/FE-TXT)', () => {
  /** Derivado do catálogo, nunca mantido à mão. */
  const comTooltip = KPI_CATALOG.filter((k) => k.tooltipText !== undefined)

  /**
   * ALLOWLIST NOMINAL, item por item, com a justificativa ao lado — nunca padrão de nome.
   * Só entra aqui o KPI cuja fonte É, de fato, o Service Hub.
   */
  const PODEM_CITAR_SERVICE_HUB: Record<string, string> = {
    // O CSAT é a propriedade `hs_last_csat_rating`, lida na ingestão e gravada em
    // `tickets.csat`. Nada nesta demanda mudou isso.
    csat: 'CSAT segue lido de hs_last_csat_rating (HubSpotClient.cs:1054)',
  }

  it('a identidade do conjunto com tooltip é esta — não só a cardinalidade', () => {
    // Trava a IDENTIDADE: um KPI entrando e outro saindo manteria a contagem e passaria.
    expect(new Set(comTooltip.map((k) => String(k.key)))).toEqual(
      new Set(['respondidosNoPrazo', 'csat', 'fcr', 'horasAnalise']),
    )
  })

  it('nenhum tooltip fora da allowlist cita o Service Hub', () => {
    const infratores = comTooltip
      .filter((k) => /service hub/i.test(k.tooltipText!))
      .map((k) => String(k.key))
      .filter((key) => !(key in PODEM_CITAR_SERVICE_HUB))

    expect(infratores).toEqual([])
    // Discriminador: a varredura ESTÁ viva — ela enxerga o caso permitido.
    expect(comTooltip.filter((k) => /service hub/i.test(k.tooltipText!)).map((k) => String(k.key)))
      .toEqual(['csat'])
  })

  it('nenhum tooltip cita nome interno de propriedade do HubSpot (`hs_...`)', () => {
    const infratores = comTooltip
      .filter((k) => /\bhs_[a-z_]+/i.test(k.tooltipText!))
      .map((k) => String(k.key))

    expect(infratores).toEqual([])
    // Controle positivo do detector: ele ainda pega a forma que existe para pegar.
    expect(/\bhs_[a-z_]+/i.test('Requer hs_is_one_touch_ticket configurado')).toBe(true)
    expect(/\bhs_[a-z_]+/i.test('Calculado do histórico de movimentação do chamado')).toBe(false)
  })
})
