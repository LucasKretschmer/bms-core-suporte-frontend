/**
 * Testes de 057 — Colunas de Apontamentos por Projeto.
 *
 * Cobertura:
 *   - Mapeamento dos campos do DTO para cada coluna (null-safe).
 *   - Whitelist de sortBy do backend (inicioem | totalsegundos | projeto | atendente).
 *   - Privacidade: nenhuma coluna expõe hubspotTicketId nem categoria do HubSpot.
 *   - Faturamento via Badge.
 */

import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { buildProjectAppointmentsColumns } from './columns'
import type { ProjectAppointmentReportItemDto } from '../shared/types/reports'

const BASE_ITEM: ProjectAppointmentReportItemDto = {
  timeEntryId: 1,
  projetoId: 45,
  projetoNome: 'Onboarding ACME',
  stage: 'Kickoff',
  clienteNome: 'ACME',
  equipeAtribuida: 'Onboarding BR',
  atendente: 'Ana Lima',
  categorizacaoAtendimento: 'Consultoria',
  faturamento: 'Faturado',
  dataApontamento: '2024-03-15T14:30:00Z',
  totalSegundos: 3723,
}

function getColumn(key: string) {
  const cols = buildProjectAppointmentsColumns()
  const col = cols.find((c) => c.key === key)
  if (!col) throw new Error(`Coluna "${key}" não encontrada`)
  return col
}

describe('buildProjectAppointmentsColumns — mapeamento', () => {
  it('coluna projeto acessa projetoNome', () => {
    expect(getColumn('projeto').accessor(BASE_ITEM)).toBe('Onboarding ACME')
  })

  it('coluna projeto retorna "—" quando projetoNome é null', () => {
    expect(getColumn('projeto').accessor({ ...BASE_ITEM, projetoNome: null })).toBe('—')
  })

  it('coluna stage acessa stage e cai para "—" quando null', () => {
    expect(getColumn('stage').accessor(BASE_ITEM)).toBe('Kickoff')
    expect(getColumn('stage').accessor({ ...BASE_ITEM, stage: null })).toBe('—')
  })

  it('coluna cliente acessa clienteNome', () => {
    expect(getColumn('cliente').accessor(BASE_ITEM)).toBe('ACME')
    expect(getColumn('cliente').accessor({ ...BASE_ITEM, clienteNome: null })).toBe('—')
  })

  it('coluna equipe acessa equipeAtribuida', () => {
    expect(getColumn('equipe').accessor(BASE_ITEM)).toBe('Onboarding BR')
    expect(getColumn('equipe').accessor({ ...BASE_ITEM, equipeAtribuida: null })).toBe('—')
  })

  it('coluna atendente acessa atendente', () => {
    expect(getColumn('atendente').accessor(BASE_ITEM)).toBe('Ana Lima')
    expect(getColumn('atendente').accessor({ ...BASE_ITEM, atendente: '' })).toBe('—')
  })

  it('coluna tempo formata segundos como "Xh Ym"', () => {
    expect(getColumn('tempo').accessor(BASE_ITEM)).toBe('1h 2m')
  })

  it('coluna dataApontamento formata data e hora pt-BR', () => {
    const result = getColumn('dataApontamento').accessor(BASE_ITEM)
    expect(result as string).toMatch(/\d{2}\/\d{2}\/\d{4}/)
  })

  it('coluna faturamento renderiza Badge com o valor do DTO', () => {
    const { getByText } = render(<>{getColumn('faturamento').accessor(BASE_ITEM)}</>)
    expect(getByText('Faturado')).toBeInTheDocument()
  })
})

describe('buildProjectAppointmentsColumns — ordenação (whitelist backend)', () => {
  it('sortKeys estão dentro da whitelist: inicioem | totalsegundos | projeto | atendente', () => {
    const ALLOWED = ['inicioem', 'totalsegundos', 'projeto', 'atendente']
    const cols = buildProjectAppointmentsColumns()
    cols.forEach((col) => {
      if (col.sortKey) expect(ALLOWED).toContain(col.sortKey)
    })
  })

  it('coluna projeto é ordenável com sortKey "projeto"', () => {
    const col = getColumn('projeto')
    expect(col.sortable).toBe(true)
    expect(col.sortKey).toBe('projeto')
  })

  it('coluna atendente é ordenável com sortKey "atendente"', () => {
    const col = getColumn('atendente')
    expect(col.sortable).toBe(true)
    expect(col.sortKey).toBe('atendente')
  })

  it('coluna dataApontamento ordena por "inicioem"', () => {
    expect(getColumn('dataApontamento').sortKey).toBe('inicioem')
  })

  it('coluna tempo ordena por "totalsegundos"', () => {
    expect(getColumn('tempo').sortKey).toBe('totalsegundos')
  })

  it('colunas sem suporte de sort no backend ficam sortable:false (não forja client-side)', () => {
    expect(getColumn('stage').sortable).toBe(false)
    expect(getColumn('cliente').sortable).toBe(false)
    expect(getColumn('equipe').sortable).toBe(false)
    expect(getColumn('categorizacaoAtendimento').sortable).toBe(false)
    expect(getColumn('faturamento').sortable).toBe(false)
  })
})

describe('buildProjectAppointmentsColumns — privacidade (project-centric)', () => {
  it('nenhuma coluna expõe hubspotTicketId nem categoria do HubSpot', () => {
    const cols = buildProjectAppointmentsColumns()
    const keys = cols.map((c) => c.key.toLowerCase())
    const headers = cols.map((c) => c.header.toLowerCase())
    expect(keys.some((k) => k.includes('hubspot') || k.includes('ticket'))).toBe(false)
    expect(headers.some((h) => h.includes('invoicy') || h.includes('hubspot'))).toBe(false)
  })
})
