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
      'TME / 1ª resposta (corridas)',
      '1ª resposta (horas úteis)',
      'Respondidos no prazo (SLA)',
      'Respondidos fora do prazo',
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
