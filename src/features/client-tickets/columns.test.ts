import { describe, expect, it } from 'vitest'
import { buildClientTicketsColumns } from './columns'

/**
 * Whitelist de sortBy do backend (GET /reports/tickets):
 *   hubspotticketid, assunto, cliente, equipe, owner, status, tempo, apontamentos.
 * As colunas só podem declarar sortKey dentro dessa whitelist (053).
 */
const ALLOWED_SORT_KEYS = [
  'hubspotticketid',
  'assunto',
  'cliente',
  'equipe',
  'owner',
  'status',
  'tempo',
  'apontamentos',
]

describe('buildClientTicketsColumns — ordenação', () => {
  it('todos os sortKey declarados estão na whitelist do backend', () => {
    buildClientTicketsColumns().forEach((col) => {
      if (col.sortKey) {
        expect(ALLOWED_SORT_KEYS).toContain(col.sortKey)
      }
    })
  })

  it('coluna "Equipe" é sortável por equipe (053 — backend suporta)', () => {
    const col = buildClientTicketsColumns().find((c) => c.key === 'equipe')!
    expect(col.sortable).toBe(true)
    expect(col.sortKey).toBe('equipe')
  })

  it('colunas suportadas pelo backend ficam sortáveis', () => {
    const cols = buildClientTicketsColumns()
    const sortableKeys = cols.filter((c) => c.sortable).map((c) => c.key)
    expect(sortableKeys).toEqual([
      'ticket',
      'assunto',
      'equipe',
      'owner',
      'status',
      'tempo',
      'apontamentos',
    ])
  })
})
