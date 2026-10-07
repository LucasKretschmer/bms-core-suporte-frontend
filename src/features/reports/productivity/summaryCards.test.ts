import { describe, expect, it } from 'vitest'
import { buildSummaryCards } from './summaryCards'
import type { ProductivitySummaryDto } from '../shared/types/reports'

const resumo: ProductivitySummaryDto = {
  totalSegundos: 9000,
  totalAtendentes: 3,
  totalAtendimentos: 12,
  mediaAtendimentosPorAtendente: 4,
  medianaAtendimentosPorAtendente: 3.5,
  totalTickets: 7,
  mediaSegundosPorTicket: 1800,
  medianaSegundosPorTicket: 1200,
}

describe('buildSummaryCards', () => {
  it('global: ordem e formatação dos 5 cards', () => {
    expect(buildSummaryCards(resumo, 'global')).toEqual([
      { label: 'Tempo total', value: '2h 30m' },
      { label: 'Média de atendimentos por atendente', value: '4,00' },
      { label: 'Mediana de atendimentos por atendente', value: '3,50' },
      { label: 'Média de tempo por ticket', value: '0h 30m' },
      { label: 'Mediana de tempo por ticket', value: '0h 20m' },
    ])
  })

  it('atendente: tempo total, atendimentos, tickets, média e mediana por ticket', () => {
    expect(buildSummaryCards(resumo, 'atendente')).toEqual([
      { label: 'Tempo total', value: '2h 30m' },
      { label: 'Atendimentos', value: '12' },
      { label: 'Tickets', value: '7' },
      { label: 'Média de tempo por ticket', value: '0h 30m' },
      { label: 'Mediana de tempo por ticket', value: '0h 20m' },
    ])
  })

  it('chave ausente no wire (sem ticket) vira "-"', () => {
    const semTicket = JSON.parse(
      '{"totalSegundos":0,"totalAtendentes":0,"totalAtendimentos":0,' +
        '"mediaAtendimentosPorAtendente":0,"medianaAtendimentosPorAtendente":0,"totalTickets":0}',
    ) as ProductivitySummaryDto

    const cards = buildSummaryCards(semTicket, 'global')
    expect(cards[0].value).toBe('0h 0m')
    expect(cards[3].value).toBe('-')
    expect(cards[4].value).toBe('-')
  })
})
