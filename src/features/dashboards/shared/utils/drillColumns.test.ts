/**
 * Testes das colunas de drill das famílias apontamento/cliente/projeto (016).
 * Funções puras — verifica chaves, sortKeys (whitelist do backend) e accessors.
 */

import { describe, it, expect } from 'vitest'
import { apontamentoDrillColumns } from './apontamentoDrillColumns'
import { clienteDrillColumns } from './clienteDrillColumns'
import { projetoDrillColumns } from './projetoDrillColumns'
import { buildDrillExportColumns, buildDrillExportRows } from '../components/MetricDrillModal'
import { chavesDeDuracao, assertCelulasDeDuracaoSaoNumericas } from '../../../../test/duracaoExport'
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

  /**
   * 134/U12 — assert REESCRITO. Era `expect(String(accessor(row))).toContain('1')` com
   * `totalSegundos: 3600`: `'1h 0m'` contém `'1'`, mas `'01:00:00'` **também**, então ele
   * sobrevivia exatamente à mutação que a 134 arrisca (o `accessor` da TELA passar a usar o
   * formato do ARQUIVO). Era um assert legado da 129, inerte. Agora afirma o literal.
   * O irmão desta trava é `T-TELA-2`, no fim deste arquivo, com 9840 s.
   */
  it('accessor de tempo formata segundos no formato da TELA ("1h 0m"), nunca no do arquivo', () => {
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
    expect(tempoCol.accessor(row)).toBe('1h 0m')
    // Negativa nomeando o que NÃO pode acontecer: o formato do arquivo na tela.
    expect(tempoCol.accessor(row)).not.toBe('01:00:00')
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

/**
 * 134 — export calculável das famílias CLIENTE (2 colunas) e APONTAMENTO (1 coluna).
 *
 * O conjunto de chaves de duração é DERIVADO da declaração (presença de `durationSeconds`
 * na `ColumnDef`), via a projeção REAL do `MetricDrillModal` — não há lista paralela
 * mantida à mão (`AP-QA-019`), e a identidade é travada com os nomes literais.
 *
 * Cardinalidades propositalmente DIFERENTES entre as famílias (cliente 2, apontamento 1,
 * ticket 4 em `ticketDrillColumns.test.ts`): contagem simétrica não discriminaria.
 */
describe('clienteDrillColumns — export calculável de duração (134)', () => {
  const LINHA: ClientRowDto = {
    clientId: 1,
    nomeFantasia: 'ACME',
    planNome: 'Premium',
    horasContratadas: 100,
    horasConsumidas: 96,
    percentualConsumo: 96,
    faixa: 'vermelho',
  }

  const cols = () => buildDrillExportColumns(clienteDrillColumns())

  it('identidade LITERAL do conjunto de colunas de duração (2) — percentual fora', () => {
    expect(chavesDeDuracao(cols()).sort()).toEqual(['horasConsumidas', 'horasContratadas'])
    // `percentualConsumo` é PERCENTUAL, não duração: marcá-lo daria `0,04:00:00` na planilha.
    expect(chavesDeDuracao(cols())).not.toContain('percentualConsumo')
  })

  it('🔴 as células saem em SEGUNDOS — literais à mão, valores diferentes por coluna', () => {
    const colunas = clienteDrillColumns()
    const [linha] = buildDrillExportRows(colunas, [LINHA])
    expect(linha.horasContratadas).toBe(360000) // 100 h
    expect(linha.horasConsumidas).toBe(345600) // 96 h
    // Colunas de TEXTO da mesma linha continuam vindo do accessor.
    expect(linha.nomeFantasia).toBe('ACME')
    expect(linha.planNome).toBe('Premium')
    // Percentual continua TEXTO formatado (não virou número de duração).
    expect(typeof linha.percentualConsumo).toBe('string')
    expect(String(linha.percentualConsumo)).toContain('96,0')
    assertCelulasDeDuracaoSaoNumericas(cols(), [linha])
  })

  it('`0` é valor e `null` do wire é ausência (célula vazia), nunca 0', () => {
    const colunas = clienteDrillColumns()
    const [zero] = buildDrillExportRows(colunas, [{ ...LINHA, horasConsumidas: 0 }])
    expect(zero.horasConsumidas).toBe(0)

    // `null` EXPLÍCITO: o contrato declara `number`, mas quem serializa é o outro lado —
    // `== null` é o guard certo para campo que atravessa a rede (AP-FRONTEND-028).
    const comNull = { ...LINHA, horasConsumidas: null } as unknown as ClientRowDto
    const [linha] = buildDrillExportRows(colunas, [comNull])
    expect(linha.nomeFantasia).toBe('ACME') // companheira positiva na mesma execução
    expect(linha.horasConsumidas).toBeNull()
    expect(linha.horasContratadas).toBe(360000) // a coluna irmã segue com valor
  })

  it('T-TELA: os accessors continuam exibindo "Xh Ym" (a tela NÃO muda)', () => {
    const colunas = clienteDrillColumns()
    const texto = (key: string) => colunas.find((c) => c.key === key)!.accessor(LINHA)
    expect(texto('horasContratadas')).toBe('100h 0m')
    expect(texto('horasConsumidas')).toBe('96h 0m')
  })
})

describe('apontamentoDrillColumns — export calculável de duração (134)', () => {
  const LINHA: TimeEntryDrillRowDto = {
    timeEntryId: 1,
    ticketId: 9,
    hubspotTicketId: '500',
    assunto: 'X',
    atendente: 'Fulano',
    equipe: 'Suporte',
    dataApontamento: '2026-06-10',
    totalSegundos: 9840,
    categorizacaoAtendimento: 'Plantão',
  }

  const cols = () => buildDrillExportColumns(apontamentoDrillColumns())

  it('identidade LITERAL do conjunto de colunas de duração (1)', () => {
    expect(chavesDeDuracao(cols())).toEqual(['totalSegundos'])
  })

  it('🔴 a célula sai em SEGUNDOS, sem conversão (o wire já é segundos)', () => {
    const [linha] = buildDrillExportRows(apontamentoDrillColumns(), [LINHA])
    expect(linha.totalSegundos).toBe(9840)
    // Coluna de TEXTO vizinha intacta.
    expect(linha.hubspotTicketId).toBe('#500')
    expect(linha.atendente).toBe('Fulano')
    assertCelulasDeDuracaoSaoNumericas(cols(), [linha])
  })

  it('`0` é valor e `null` do wire é ausência (célula vazia)', () => {
    const colunas = apontamentoDrillColumns()
    const [zero] = buildDrillExportRows(colunas, [{ ...LINHA, totalSegundos: 0 }])
    expect(zero.totalSegundos).toBe(0)

    const comNull = { ...LINHA, totalSegundos: null } as unknown as TimeEntryDrillRowDto
    const [linha] = buildDrillExportRows(colunas, [comNull])
    expect(linha.atendente).toBe('Fulano') // companheira positiva
    expect(linha.totalSegundos).toBeNull()
  })

  it('T-TELA-2: o accessor de tempo continua "2h 44m" (a tela NÃO muda)', () => {
    const tempoCol = apontamentoDrillColumns().find((c) => c.key === 'totalSegundos')!
    expect(tempoCol.accessor(LINHA)).toBe('2h 44m')
    expect(tempoCol.accessor({ ...LINHA, totalSegundos: 0 })).toBe('0h 0m')
  })
})
