import { describe, expect, it } from 'vitest'
import { buildTicketBreadcrumb } from './buildBreadcrumb'

describe('buildTicketBreadcrumb', () => {
  it('origem consumo-planos: inclui Consumo de Planos + Cliente + Ticket', () => {
    const items = buildTicketBreadcrumb({
      from: 'consumo-planos',
      clientId: 'c1',
      clienteNome: 'ACME',
      hubspotTicketId: '123',
    })
    expect(items.map((i) => i.label)).toEqual([
      'Relatórios',
      'Consumo de Planos',
      'ACME',
      '#123',
    ])
    // O item Cliente leva params + search de origem.
    const cliente = items[2]
    expect(cliente.href).toBe('/relatorios/clientes/$clientId')
    expect(cliente.params).toEqual({ clientId: 'c1' })
    expect(cliente.search).toEqual({ from: 'consumo-planos' })
  })

  it('origem clientes: mesma cadeia que consumo-planos', () => {
    const items = buildTicketBreadcrumb({
      from: 'clientes',
      clientId: 'c2',
      clienteNome: null,
      hubspotTicketId: '9',
    })
    expect(items.map((i) => i.label)).toEqual([
      'Relatórios',
      'Consumo de Planos',
      'Cliente',
      '#9',
    ])
  })

  it('origem consumo-planos sem clientId: omite item Cliente', () => {
    const items = buildTicketBreadcrumb({
      from: 'consumo-planos',
      hubspotTicketId: '5',
    })
    expect(items.map((i) => i.label)).toEqual([
      'Relatórios',
      'Consumo de Planos',
      '#5',
    ])
  })

  it('origem apontamentos: vai direto ao ticket', () => {
    const items = buildTicketBreadcrumb({
      from: 'apontamentos',
      hubspotTicketId: '7',
    })
    expect(items.map((i) => i.label)).toEqual([
      'Relatórios',
      'Apontamentos por Ticket',
      '#7',
    ])
  })

  it('origem cliente: usa Relatório do Cliente', () => {
    const items = buildTicketBreadcrumb({
      from: 'cliente',
      hubspotTicketId: '8',
    })
    expect(items.map((i) => i.label)).toEqual([
      'Relatórios',
      'Relatório do Cliente',
      '#8',
    ])
  })

  it('sem origem: Relatórios + Ticket', () => {
    const items = buildTicketBreadcrumb({ from: undefined, hubspotTicketId: '1' })
    expect(items.map((i) => i.label)).toEqual(['Relatórios', '#1'])
  })

  it('o item final do ticket nunca tem href', () => {
    const items = buildTicketBreadcrumb({ from: 'apontamentos', hubspotTicketId: '1' })
    expect(items[items.length - 1].href).toBeUndefined()
  })
})
