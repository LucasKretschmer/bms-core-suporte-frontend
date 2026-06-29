/**
 * Testes das colunas de drill das famílias apontamento/cliente/projeto (016).
 * Funções puras — verifica chaves, sortKeys (whitelist do backend) e accessors.
 */

import { describe, it, expect } from 'vitest'
import { apontamentoDrillColumns } from './apontamentoDrillColumns'
import { clienteDrillColumns } from './clienteDrillColumns'
import { projetoDrillColumns } from './projetoDrillColumns'
import type {
  ClientRowDto,
  ProjectRowDto,
  TimeEntryDrillRowDto,
} from '../types/metrics'

describe('apontamentoDrillColumns', () => {
  it('expõe ticket/assunto/atendente/equipe/data/tempo', () => {
    const keys = apontamentoDrillColumns().map((c) => c.key)
    expect(keys).toEqual([
      'hubspotTicketId',
      'assunto',
      'atendente',
      'equipe',
      'dataApontamento',
      'totalSegundos',
    ])
  })

  it('sortKeys batem com a whitelist do backend (inicioem/totalsegundos/atendente)', () => {
    const cols = apontamentoDrillColumns()
    const sortKeys = cols.filter((c) => c.sortable).map((c) => c.sortKey)
    expect(sortKeys).toEqual(['atendente', 'inicioem', 'totalsegundos'])
  })

  it('accessor de tempo formata segundos', () => {
    const row: TimeEntryDrillRowDto = {
      timeEntryId: 1,
      ticketId: 9,
      hubspotTicketId: '500',
      assunto: 'X',
      atendente: 'Fulano',
      equipe: 'Suporte',
      dataApontamento: '2026-06-10',
      totalSegundos: 3600,
      categorizacaoAtendimento: 'Plantão',
    }
    const tempoCol = apontamentoDrillColumns().find((c) => c.key === 'totalSegundos')!
    expect(String(tempoCol.accessor(row))).toContain('1')
  })

  it('NÃO expõe a categorização interna em coluna (AP-SECURITY-001)', () => {
    const keys = apontamentoDrillColumns().map((c) => c.key)
    expect(keys).not.toContain('categorizacaoAtendimento')
  })
})

describe('clienteDrillColumns', () => {
  it('expõe cliente/plano/horas/consumo/saúde', () => {
    const keys = clienteDrillColumns().map((c) => c.key)
    expect(keys).toEqual([
      'nomeFantasia',
      'planNome',
      'horasContratadas',
      'horasConsumidas',
      'percentualConsumo',
      'faixa',
    ])
  })

  it('sortKeys batem com a whitelist do backend', () => {
    const sortKeys = clienteDrillColumns()
      .filter((c) => c.sortable)
      .map((c) => c.sortKey)
    expect(sortKeys).toEqual([
      'nomefantasia',
      'plannome',
      'horascontratadas',
      'horasconsumidas',
      'percentual',
    ])
  })

  it('accessor de saúde traduz a faixa para rótulo legível', () => {
    const row: ClientRowDto = {
      clientId: 1,
      nomeFantasia: 'ACME',
      planNome: 'Premium',
      horasContratadas: 100,
      horasConsumidas: 96,
      percentualConsumo: 96,
      faixa: 'vermelho',
    }
    const faixaCol = clienteDrillColumns().find((c) => c.key === 'faixa')!
    expect(String(faixaCol.accessor(row))).toMatch(/Crítico/)
  })
})

describe('projetoDrillColumns', () => {
  it('expõe projeto/cliente/tipo/estágio/responsável/equipe/datas', () => {
    const keys = projetoDrillColumns().map((c) => c.key)
    expect(keys).toEqual([
      'nome',
      'clienteNome',
      'tipo',
      'stage',
      'ownerNome',
      'equipe',
      'iniciadoEm',
      'concluidoEm',
    ])
  })

  it('sortKeys batem com a whitelist do backend', () => {
    const sortKeys = projetoDrillColumns()
      .filter((c) => c.sortable)
      .map((c) => c.sortKey)
    expect(sortKeys).toEqual(['nome', 'cliente', 'stage', 'owner', 'iniciadoem', 'concluidoem'])
  })

  it('accessor de data nula vira "—"', () => {
    const row: ProjectRowDto = {
      projetoId: 1,
      nome: 'Onboarding ACME',
      clienteNome: 'ACME',
      tipo: 'Onboarding',
      stage: 'Em Execução',
      ownerNome: 'Fulano',
      equipe: 'Integração',
      iniciadoEm: '2026-06-01',
      concluidoEm: null,
    }
    const concCol = projetoDrillColumns().find((c) => c.key === 'concluidoEm')!
    expect(concCol.accessor(row)).toBe('—')
  })
})
