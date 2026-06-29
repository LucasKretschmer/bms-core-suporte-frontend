/**
 * Teste do resolver metricFamily (016): cada metric mapeia para a família correta,
 * que decide o DTO de linha, as colunas e a navegação na página.
 */

import { describe, it, expect } from 'vitest'
import { metricFamily } from './metrics'

describe('metricFamily', () => {
  it('tickets-* → ticket', () => {
    expect(metricFamily('tickets-backlog')).toBe('ticket')
    expect(metricFamily('tickets-reabertos')).toBe('ticket')
    expect(metricFamily('tickets-sla')).toBe('ticket')
  })

  it('apontamentos / apontamentos-com-pausa → apontamento', () => {
    expect(metricFamily('apontamentos')).toBe('apontamento')
    expect(metricFamily('apontamentos-com-pausa')).toBe('apontamento')
  })

  it('plan-health-clientes → cliente', () => {
    expect(metricFamily('plan-health-clientes')).toBe('cliente')
  })

  it('projetos → projeto', () => {
    expect(metricFamily('projetos')).toBe('projeto')
  })
})
