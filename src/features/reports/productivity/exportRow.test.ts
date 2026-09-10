/**
 * 129 — EXPORT de Produtividade com a chave AUSENTE no wire.
 * 134 (S10) — as duas colunas de duração saem como SEGUNDOS CRUS, não como texto.
 *
 * Teste próprio do export, e não herdado do da coluna: são dois call sites independentes
 * do mesmo campo, e foi exatamente o segundo que ficou sem cobertura (AP-FRONTEND-028).
 * Planilha errada o gestor **encaminha** — não há como corrigir depois de enviada.
 */

import { describe, expect, it } from 'vitest'
import { PRODUCTIVITY_EXPORT_COLUMNS, mapToExportRow } from './exportRow'
import { productivityColumns } from './columns'
import {
  assertCelulasDeDuracaoSaoNumericas,
  chavesDeDuracao,
} from '../../../test/duracaoExport'
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

  it('chave ausente vira célula VAZIA no AHT e "—" na equipe, nunca "NaN" nem "undefined"', () => {
    const linha = mapToExportRow(semChaves)
    // 134 — a coluna de duração ausente é `null` (célula vazia), não `'—'`: `—` é texto
    // e quebraria o contrato "a coluna é numérica". A equipe é TEXTO e segue com `—`.
    expect(linha.ahtSegundos).toBeNull()
    expect(linha.equipe).toBe('—')
    const texto = Object.values(linha).join(' | ')
    expect(texto).not.toContain('NaN')
    expect(texto).not.toContain('undefined')
  })

  it('chave NULA no AHT também vira célula vazia (irmão, mesma execução)', () => {
    // AP-FRONTEND-028: é ESTE caso que discrimina `== null` de `=== undefined`.
    // Com `=== undefined` no guard, o `null` viajaria e a célula sairia `0` — a mentira
    // "o analista atendeu com AHT zero" numa planilha que sai do sistema.
    expect(mapToExportRow({ ...completo, ahtSegundos: null }).ahtSegundos).toBeNull()
  })

  it('toda coluna declarada existe na linha gerada (nenhum campo do export sem guard)', () => {
    const linha = mapToExportRow(semChaves)
    for (const col of PRODUCTIVITY_EXPORT_COLUMNS) {
      expect(Object.hasOwn(linha, col.key)).toBe(true)
    }
  })
})

describe('mapToExportRow — duração calculável (134 · S10)', () => {
  it('controle positivo: as duas durações saem em SEGUNDOS, não em "Xh Ym"', () => {
    const linha = mapToExportRow({ ...completo, totalSegundos: 9840 })
    // Literais escritos à mão — nada derivado da própria resposta.
    expect(linha.totalSegundos).toBe(9840)
    expect(linha.ahtSegundos).toBe(1800)
    // Fica vermelho se alguém reintroduzir o `formatSeconds` no mapper.
    expect(linha.totalSegundos).not.toBe('2h 44m')
    expect(linha.ahtSegundos).not.toBe('0h 30m')
  })

  it('`0` é VALOR, não ausência — companheira positiva do caso nulo', () => {
    // Fica vermelho com a sobre-correção `if (!v) return null` no guard do núcleo.
    const linha = mapToExportRow({ ...completo, totalSegundos: 0, ahtSegundos: 0 })
    expect(linha.totalSegundos).toBe(0)
    expect(linha.ahtSegundos).toBe(0)
    expect(linha.totalSegundos).not.toBeNull()
  })

  it('a linha com as chaves ausentes traz `0` no tempo total e vazio no AHT (mesma linha)', () => {
    // As duas pontas juntas: a ausência não contamina a coluna que TEM valor.
    const linha = mapToExportRow(semChaves)
    expect(linha.totalSegundos).toBe(0)
    expect(linha.ahtSegundos).toBeNull()
  })

  it('as colunas de TEXTO não viraram duração', () => {
    const linha = mapToExportRow(completo)
    expect(linha.nome).toBe('Bruno Reis')
    expect(linha.equipe).toBe('Equipe A')
    expect(linha.mediaPausas).toBe('1,5')
    // `nAtendimentos` é CONTAGEM, não duração: continua número cru, sem `type`.
    expect(linha.nAtendimentos).toBe(4)
  })
})

describe('PRODUCTIVITY_EXPORT_COLUMNS — invariante da superfície (§9.3)', () => {
  it('identidade LITERAL do conjunto de chaves de duração', () => {
    // Identidade, nunca cardinalidade: cardinalidade passa quando uma coluna entra e
    // outra sai. Fica vermelho se alguém tirar o `type`, renomear a chave, ou marcar
    // como duração uma coluna que não é.
    expect(new Set(chavesDeDuracao(PRODUCTIVITY_EXPORT_COLUMNS))).toEqual(
      new Set(['totalSegundos', 'ahtSegundos']),
    )
  })

  it('as colunas numéricas que NÃO são duração ficam de fora do conjunto', () => {
    const chaves = chavesDeDuracao(PRODUCTIVITY_EXPORT_COLUMNS)
    expect(chaves).not.toContain('nAtendimentos')
    expect(chaves).not.toContain('mediaPausas')
    // Companheira positiva das negativas acima: o conjunto não está vazio.
    expect(chaves).toContain('totalSegundos')
  })

  it('derivado: toda chave de duração recebe `number | null` do mapper', () => {
    // A enumeração é derivada da declaração real das colunas, não mantida à mão.
    assertCelulasDeDuracaoSaoNumericas(PRODUCTIVITY_EXPORT_COLUMNS, [
      mapToExportRow(completo),
      mapToExportRow(semChaves),
      mapToExportRow({ ...completo, ahtSegundos: null }),
    ])
  })

  it('cabeçalhos, chaves e ordem das 6 colunas seguem intocados', () => {
    // A demanda troca o CONTEÚDO da célula, nunca o formato da planilha.
    expect(PRODUCTIVITY_EXPORT_COLUMNS.map((c) => [c.header, c.key])).toEqual([
      ['Analista', 'nome'],
      ['Equipe', 'equipe'],
      ['Atendimentos', 'nAtendimentos'],
      ['Tempo Total', 'totalSegundos'],
      ['AHT (Tempo Médio)', 'ahtSegundos'],
      ['Média de Pausas', 'mediaPausas'],
    ])
  })
})

/**
 * 134 — a TELA não muda. É o invariante que separa "converter o export" de "resolver a
 * demanda mudando o formatador de tela". `productivityColumns` (`columns.ts`) alimenta
 * só a tabela visível; `PRODUCTIVITY_EXPORT_COLUMNS` alimenta só o arquivo.
 */
describe('a tabela visível continua exibindo "Xh Ym" (134 · invariante de tela)', () => {
  const acessor = (key: string) => productivityColumns.find((c) => c.key === key)!.accessor

  it('"Tempo Total" na tela continua "2h 44m" para os 9840 s que o export manda crus', () => {
    expect(acessor('totalSegundos')({ ...completo, totalSegundos: 9840 })).toBe('2h 44m')
    expect(mapToExportRow({ ...completo, totalSegundos: 9840 }).totalSegundos).toBe(9840)
  })

  it('"AHT" na tela continua "2h 44m" com valor e "—" sem valor', () => {
    expect(acessor('ahtSegundos')({ ...completo, ahtSegundos: 9840 })).toBe('2h 44m')
    expect(acessor('ahtSegundos')({ ...completo, ahtSegundos: null })).toBe('—')
  })

  it('as colunas da tela não ganharam o discriminador de export', () => {
    // `type: 'duration'` é do `ExportColumn`; o `ColumnDef` da tela não o conhece.
    for (const col of productivityColumns) {
      expect(Object.hasOwn(col, 'type')).toBe(false)
    }
  })
})
