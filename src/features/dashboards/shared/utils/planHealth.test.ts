/**
 * Testes das guardas de dado do "Saúde dos Planos" (123/D4).
 *
 * Estes casos são função pura: valem ALÉM do teste de comportamento, nunca EM VEZ dele —
 * a prova de que a tela e o export usam estas guardas está em
 * `support/components/SupportPlanHealthSection.wire.test.tsx`, com payload literal do
 * backend.
 *
 * Os objetos aqui são construídos como JSON cru (`JSON.parse`) sempre que o caso é
 * "chave que o backend não emite": um literal tipado não conseguiria expressar o defeito.
 */

import { describe, it, expect } from 'vitest'
import {
  hasExportablePlanRows,
  hasPlanHealthData,
  isExportablePlanRow,
} from './planHealth'
import type { PlanHealthItemDto, PlanHealthSummaryDto } from '../types/metrics'

function summaryDoWire(json: string): PlanHealthSummaryDto {
  return JSON.parse(json) as PlanHealthSummaryDto
}

function itemDoWire(json: string): PlanHealthItemDto {
  return JSON.parse(json) as PlanHealthItemDto
}

describe('hasPlanHealthData', () => {
  it('summary do backend com clientes → true', () => {
    const summary = summaryDoWire(
      '{"totalClientes": 3, "verde": 2, "amarelo": 1, "vermelho": 0}',
    )
    expect(hasPlanHealthData(summary)).toBe(true)
  })

  it('nenhum cliente com plano no período → false (vazio honesto)', () => {
    const summary = summaryDoWire(
      '{"totalClientes": 0, "verde": 0, "amarelo": 0, "vermelho": 0}',
    )
    expect(hasPlanHealthData(summary)).toBe(false)
  })

  it('null e undefined → false', () => {
    expect(hasPlanHealthData(null)).toBe(false)
    expect(hasPlanHealthData(undefined)).toBe(false)
  })

  it('chaves divergentes do wire (o defeito da D4) → false, e não "objeto existe logo tem dado"', () => {
    const legado = summaryDoWire('{"totalVerde": 2, "totalAmarelo": 1, "totalVermelho": 0}')
    // O objeto EXISTE — era exatamente por isso que `!summary` deixava passar.
    expect(legado).not.toBeNull()
    expect(hasPlanHealthData(legado)).toBe(false)
  })

  it('total presente mas não numérico → false', () => {
    const summary = summaryDoWire(
      '{"totalClientes": 3, "verde": null, "amarelo": 1, "vermelho": 0}',
    )
    expect(hasPlanHealthData(summary)).toBe(false)
  })
})

describe('isExportablePlanRow', () => {
  const COM_CLIENTE_E_PLANO = itemDoWire(
    '{"clientId": 41, "nomeFantasia": "ACME Ltda", "planNome": "Premium", "horasContratadas": 40, "horasConsumidas": 20, "percentualConsumo": 50, "faixa": "verde"}',
  )

  it('linha com cliente e plano → exportável', () => {
    expect(isExportablePlanRow(COM_CLIENTE_E_PLANO)).toBe(true)
  })

  it('cliente sem nomeFantasia mas com plano → exportável (a linha ainda se identifica)', () => {
    const item = itemDoWire(
      '{"clientId": 42, "planNome": "Premium", "horasContratadas": 40, "horasConsumidas": 20, "percentualConsumo": 50, "faixa": "verde"}',
    )
    expect(isExportablePlanRow(item)).toBe(true)
  })

  it('chave AUSENTE nos dois nomes (WhenWritingNull) → não exportável', () => {
    const item = itemDoWire(
      '{"clientId": 43, "horasContratadas": 8, "horasConsumidas": 7, "percentualConsumo": 87.5, "faixa": "amarelo"}',
    )
    expect(isExportablePlanRow(item)).toBe(false)
  })

  it('null EXPLÍCITO nos dois nomes → não exportável (== null, nunca === undefined)', () => {
    const item = itemDoWire(
      '{"clientId": 43, "nomeFantasia": null, "planNome": null, "horasContratadas": 8, "horasConsumidas": 7, "percentualConsumo": 87.5, "faixa": "amarelo"}',
    )
    expect(isExportablePlanRow(item)).toBe(false)
  })

  it('nome só com espaços → não exportável', () => {
    const item = itemDoWire(
      '{"clientId": 44, "nomeFantasia": "   ", "planNome": "", "horasContratadas": 8, "horasConsumidas": 7, "percentualConsumo": 87.5, "faixa": "amarelo"}',
    )
    expect(isExportablePlanRow(item)).toBe(false)
  })

  it('item com as chaves ANTIGAS do front → não exportável (era o CSV inteiro em "—")', () => {
    const legado = itemDoWire(
      '{"clientId": 41, "nomeCliente": "ACME Ltda", "nomePlano": "Premium", "horasPlano": 40, "horasUsadas": 20, "percentualConsumo": 50, "faixaSaude": "verde"}',
    )
    expect(isExportablePlanRow(legado)).toBe(false)
  })

  it('hasExportablePlanRows: basta UMA linha identificável no conjunto', () => {
    const anonima = itemDoWire(
      '{"clientId": 43, "horasContratadas": 8, "horasConsumidas": 7, "percentualConsumo": 87.5, "faixa": "amarelo"}',
    )
    expect(hasExportablePlanRows([anonima, COM_CLIENTE_E_PLANO])).toBe(true)
    expect(hasExportablePlanRows([anonima])).toBe(false)
    expect(hasExportablePlanRows([])).toBe(false)
  })
})
