import { afterEach, describe, expect, it } from 'vitest'
import {
  clearReportFilters,
  loadReportFilters,
  saveReportFilters,
} from './reportFilters'

type Filters = { search: string; planId: string | null }

describe('reportFilters', () => {
  afterEach(() => {
    sessionStorage.clear()
  })

  it('faz round-trip de save/load', () => {
    const filters: Filters = { search: 'acme', planId: 'p1' }
    saveReportFilters('plan-consumption', filters)
    const loaded = loadReportFilters<Filters>('plan-consumption', {
      search: '',
      planId: null,
    })
    expect(loaded).toEqual(filters)
  })

  it('retorna fallback quando a chave não existe', () => {
    const fallback: Filters = { search: '', planId: null }
    expect(loadReportFilters('inexistente', fallback)).toEqual(fallback)
  })

  it('retorna fallback quando o JSON é inválido', () => {
    sessionStorage.setItem('report-filters:quebrado', '{nao-e-json')
    const fallback: Filters = { search: '', planId: null }
    expect(loadReportFilters('quebrado', fallback)).toEqual(fallback)
  })

  it('mescla valores parciais sobre o fallback', () => {
    sessionStorage.setItem('report-filters:parcial', JSON.stringify({ search: 'x' }))
    const loaded = loadReportFilters<Filters>('parcial', {
      search: '',
      planId: 'default',
    })
    expect(loaded).toEqual({ search: 'x', planId: 'default' })
  })

  it('clear remove a chave', () => {
    saveReportFilters('apagavel', { search: 'a', planId: null })
    clearReportFilters('apagavel')
    const fallback: Filters = { search: '', planId: null }
    expect(loadReportFilters('apagavel', fallback)).toEqual(fallback)
  })
})
