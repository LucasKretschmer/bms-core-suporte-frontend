/**
 * Testes de ticketDrillColumns (016).
 * Verifica: colunas base presentes em todo metric; colunas específicas por metric;
 * tradução do FrSla; nenhuma coluna expõe categoria HubSpot proibida (AP-SECURITY-001).
 */

import { describe, it, expect } from 'vitest'
import { ticketDrillColumns } from './ticketDrillColumns'
import { CATEGORIAS_PROIBIDAS } from './kpiCatalog'
import type { TicketMetricKey, TicketRowDto } from '../types/metrics'

const ALL_METRICS: TicketMetricKey[] = [
  'tickets-backlog',
  'tickets-abertos',
  'tickets-resolvidos',
  'tickets-reabertos',
  'tickets-tempos',
  'tickets-sla',
  'tickets-csat',
  'tickets-fcr',
]

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
