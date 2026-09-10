/**
 * 134 · S4 — EXPORT de "Apontamentos por Projeto": a coluna `Tempo` sai CALCULÁVEL.
 *
 * O campo `totalSegundos` tem dois call sites independentes nesta feature:
 *   - a TELA (`columns.tsx`) → continua "2h 44m" via `formatSeconds`;
 *   - o EXPORT (`index.tsx::mapToExportRow`) → passa a entregar SEGUNDOS CRUS, e a
 *     formatação (`[h]:mm:ss` no XLSX, `H:mm:ss` no CSV) mora no núcleo.
 *
 * O export é o menos testado dos call sites e o mais grave quando erra — planilha errada
 * o gestor encaminha, tela errada ele recarrega (AP-FRONTEND-028). Por isso ele tem teste
 * próprio, e não herda o da coluna.
 */

import { describe, expect, it } from 'vitest'
import {
  assertCelulasDeDuracaoSaoNumericas,
  chavesDeDuracao,
} from '../../../test/duracaoExport'
import { EXPORT_COLUMNS, mapToExportRow } from './index'
import { buildProjectAppointmentsColumns } from './columns'
import type { ProjectAppointmentReportItemDto } from '../shared/types/reports'

/** 9840 s = 2h44 — o mesmo literal que a tela exibe como "2h 44m". */
const BASE: ProjectAppointmentReportItemDto = {
  timeEntryId: 1,
  projetoId: 10,
  projetoNome: 'Migração Fiscal',
  stage: 'Execução',
  clienteNome: 'Cliente X',
  equipeAtribuida: 'Equipe A',
  atendente: 'Ana Lima',
  categorizacaoAtendimento: 'Suporte',
  faturamento: 'Faturado',
  dataApontamento: '2026-09-08T12:00:00Z',
  totalSegundos: 9840,
}

/**
 * O DTO declara `totalSegundos: number`, mas quem produz o valor é a rede — e nada
 * garante o serializador do outro lado. O guard tem de cobrir `null` EXPLÍCITO e chave
 * ausente (AP-FRONTEND-028: `=== undefined` passaria no segundo e falharia no primeiro).
 */
const TEMPO_NULO = { ...BASE, totalSegundos: null } as unknown as ProjectAppointmentReportItemDto

const SEM_CHAVE_TEMPO = (() => {
  const wire: Record<string, unknown> = { ...BASE }
  delete wire.totalSegundos
  return wire as unknown as ProjectAppointmentReportItemDto
})()

describe('S4 · EXPORT_COLUMNS — identidade do inventário de duração (134 §9.3)', () => {
  it('a ÚNICA coluna de duração é `tempo` (identidade literal, não cardinalidade)', () => {
    expect(new Set(chavesDeDuracao(EXPORT_COLUMNS))).toEqual(new Set(['tempo']))
  })

  it('`Data do apontamento` é INSTANTE e continua sem `type` — não é duração', () => {
    const dataApontamento = EXPORT_COLUMNS.find((c) => c.key === 'dataApontamento')
    expect(dataApontamento?.header).toBe('Data do apontamento')
    expect(dataApontamento?.type).toBeUndefined()
  })

  it('cabeçalhos e ordem das 9 colunas continuam os mesmos (o arquivo não muda de forma)', () => {
    expect(EXPORT_COLUMNS.map((c) => c.header)).toEqual([
      'Projeto',
      'Stage',
      'Cliente',
      'Equipe',
      'Atendente',
      'Categorização do atendimento',
      'Faturamento',
      'Data do apontamento',
      'Tempo',
    ])
    expect(EXPORT_COLUMNS.map((c) => c.key)).toEqual([
      'projeto',
      'stage',
      'cliente',
      'equipe',
      'atendente',
      'categorizacaoAtendimento',
      'faturamento',
      'dataApontamento',
      'tempo',
    ])
  })
})

describe('S4 · mapToExportRow — a célula de duração é NÚMERO, nunca texto (134)', () => {
  it('toda chave de duração derivada das colunas sai `number | null` no mapper', () => {
    assertCelulasDeDuracaoSaoNumericas(EXPORT_COLUMNS, [
      mapToExportRow(BASE),
      mapToExportRow({ ...BASE, totalSegundos: 0 }),
      mapToExportRow(TEMPO_NULO),
    ])
  })

  it('9840 s vira o número 9840 — não "2h 44m", não "02:44:00"', () => {
    const linha = mapToExportRow(BASE)
    expect(linha.tempo).toBe(9840)
    expect(typeof linha.tempo).toBe('number')
  })

  it('acima de 24 h o mapper não trunca: 95400 s continua 95400 (o núcleo é que formata)', () => {
    expect(mapToExportRow({ ...BASE, totalSegundos: 95400 }).tempo).toBe(95400)
  })

  it('0 segundos é VALOR, não ausência — sai 0 (companheira positiva do caso nulo)', () => {
    const linha = mapToExportRow({ ...BASE, totalSegundos: 0 })
    expect(linha.tempo).toBe(0)
    expect(linha.tempo).not.toBeNull()
  })

  it('`null` EXPLÍCITO no wire vira célula vazia (`null`), nunca 0', () => {
    // Discriminador do fixture: sem isto, o caso poderia estar passando com 9840.
    expect(TEMPO_NULO.totalSegundos).toBeNull()
    expect(mapToExportRow(TEMPO_NULO).tempo).toBeNull()
  })

  it('chave AUSENTE no wire também vira célula vazia (`null`)', () => {
    expect(Object.hasOwn(SEM_CHAVE_TEMPO, 'totalSegundos')).toBe(false)
    expect(mapToExportRow(SEM_CHAVE_TEMPO).tempo).toBeNull()
  })

  it('segundos negativos são clampados em 0 — o Excel não exibe tempo negativo', () => {
    expect(mapToExportRow({ ...BASE, totalSegundos: -3600 }).tempo).toBe(0)
  })
})

describe('S4 · o resto da linha não mudou (134)', () => {
  it('toda coluna declarada existe na linha gerada', () => {
    const linha = mapToExportRow(BASE)
    for (const col of EXPORT_COLUMNS) {
      expect(Object.hasOwn(linha, col.key)).toBe(true)
    }
  })

  it('as colunas de TEXTO continuam com os mesmos valores e com "—" para ausente', () => {
    const linha = mapToExportRow(BASE)
    expect(linha.projeto).toBe('Migração Fiscal')
    expect(linha.stage).toBe('Execução')
    expect(linha.cliente).toBe('Cliente X')
    expect(linha.equipe).toBe('Equipe A')
    expect(linha.atendente).toBe('Ana Lima')
    expect(linha.categorizacaoAtendimento).toBe('Suporte')
    expect(linha.faturamento).toBe('Faturado')
    expect(typeof linha.dataApontamento).toBe('string')

    const semTexto = mapToExportRow({
      ...BASE,
      projetoNome: null,
      stage: null,
      clienteNome: null,
      equipeAtribuida: null,
      atendente: '',
      categorizacaoAtendimento: null,
    })
    expect(semTexto.projeto).toBe('—')
    expect(semTexto.stage).toBe('—')
    expect(semTexto.cliente).toBe('—')
    expect(semTexto.equipe).toBe('—')
    expect(semTexto.atendente).toBe('—')
    expect(semTexto.categorizacaoAtendimento).toBe('—')
    // O "—" é da coluna de TEXTO: na de duração, ausência é célula vazia (`null`).
    expect(semTexto.tempo).toBe(9840)
  })
})

describe('S4 · a TELA não mudou (134 · T-TELA)', () => {
  it('mesmo item: a coluna visível exibe "2h 44m" enquanto o export leva 9840', () => {
    const colunaTempo = buildProjectAppointmentsColumns().find((c) => c.key === 'tempo')
    expect(colunaTempo).toBeDefined()
    expect(colunaTempo?.accessor(BASE)).toBe('2h 44m')
    expect(mapToExportRow(BASE).tempo).toBe(9840)
  })
})
