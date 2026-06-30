/**
 * Testes das colunas da Movimentação Diária (021) — foco no contrato de ordenação (056).
 *
 * A coluna "status" foi religada na 056 (backend passou a aceitar sortBy=status).
 * Demais colunas (data, equipe, quantidade, atualizadoem) não regridem.
 */

import { describe, it, expect } from 'vitest'
import { buildMovimentacaoDiariaColumns } from './columns'

/** Whitelist de sortBy do backend após a 056. */
const ALLOWED_SORT_KEYS = ['data', 'quantidade', 'equipe', 'atualizadoem', 'status']

function getColumn(key: string) {
  const cols = buildMovimentacaoDiariaColumns()
  const col = cols.find((c) => c.key === key)
  if (!col) throw new Error(`Coluna "${key}" não encontrada`)
  return col
}

describe('buildMovimentacaoDiariaColumns — estrutura e ordenação', () => {
  it('tem as 5 colunas na ordem correta', () => {
    const keys = buildMovimentacaoDiariaColumns().map((c) => c.key)
    expect(keys).toEqual(['data', 'status', 'equipe', 'quantidade', 'atualizadoEm'])
  })

  it('coluna "status" é sortável com sortKey "status" (religada na 056)', () => {
    const col = getColumn('status')
    expect(col.sortable).toBe(true)
    expect(col.sortKey).toBe('status')
  })

  it('todos os sortKeys estão dentro da whitelist do backend', () => {
    buildMovimentacaoDiariaColumns().forEach((col) => {
      if (col.sortKey) {
        expect(ALLOWED_SORT_KEYS).toContain(col.sortKey)
      }
    })
  })

  it('não regride os sortKeys das demais colunas', () => {
    expect(getColumn('data').sortKey).toBe('data')
    expect(getColumn('equipe').sortKey).toBe('equipe')
    expect(getColumn('quantidade').sortKey).toBe('quantidade')
    expect(getColumn('atualizadoEm').sortKey).toBe('atualizadoem')
  })
})
