/**
 * 129 — EXPORT de Produtividade com a chave AUSENTE no wire.
 *
 * Teste próprio do export, e não herdado do da coluna: são dois call sites independentes
 * do mesmo campo, e foi exatamente o segundo que ficou sem cobertura (AP-FRONTEND-028).
 */

import { describe, expect, it } from 'vitest'
import { PRODUCTIVITY_EXPORT_COLUMNS, mapToExportRow } from './exportRow'
import type { AgentMetricDto } from '../shared/types/reports'

/** Wire de um analista sem AHT e sem equipe: as chaves NÃO VÊM (não vêm `null`). */
const semChaves: AgentMetricDto = {
  userId: 7,
  nome: 'Ana Lima',
  nAtendimentos: 0,
  totalSegundos: 0,
  mediaPausas: null,
}

const completo: AgentMetricDto = {
  userId: 8,
  nome: 'Bruno Reis',
  equipe: 'Equipe A',
  nAtendimentos: 4,
  totalSegundos: 7200,
  ahtSegundos: 1800,
  mediaPausas: 1.5,
}

describe('mapToExportRow — a planilha nunca sai com NaN (129)', () => {
  it('discrimina os fixtures: um NÃO tem as chaves, o outro tem', () => {
    expect(Object.hasOwn(semChaves, 'ahtSegundos')).toBe(false)
    expect(Object.hasOwn(semChaves, 'equipe')).toBe(false)
    expect(Object.hasOwn(completo, 'ahtSegundos')).toBe(true)
  })

  it('chave ausente vira "—" no AHT e na equipe, nunca "NaN" nem "undefined"', () => {
    const linha = mapToExportRow(semChaves)
    expect(linha.ahtSegundos).toBe('—')
    expect(linha.equipe).toBe('—')
    const texto = Object.values(linha).join(' | ')
    expect(texto).not.toContain('NaN')
    expect(texto).not.toContain('undefined')
  })

  it('chave NULA no AHT também vira "—" (irmão, mesma execução)', () => {
    expect(mapToExportRow({ ...completo, ahtSegundos: null }).ahtSegundos).toBe('—')
  })

  it('controle positivo: valores presentes continuam formatados', () => {
    const linha = mapToExportRow(completo)
    expect(linha.ahtSegundos).toBe('0h 30m')
    expect(linha.equipe).toBe('Equipe A')
  })

  it('toda coluna declarada existe na linha gerada (nenhum campo do export sem guard)', () => {
    const linha = mapToExportRow(semChaves)
    for (const col of PRODUCTIVITY_EXPORT_COLUMNS) {
      expect(Object.hasOwn(linha, col.key)).toBe(true)
    }
  })
})
