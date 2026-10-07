/**
 * Export da Produtividade com chave ausente no wire e durações em segundos crus.
 * Teste próprio do export: é outro call site do mesmo campo, e planilha errada sai do sistema.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PRODUCTIVITY_EXPORT_COLUMNS, mapToExportRow } from './exportRow'
import { fetchProductivityForExport } from './fetchProductivityForExport'
import { productivityColumns } from './columns'
import {
  assertCelulasDeDuracaoSaoNumericas,
  chavesDeDuracao,
} from '../../../test/duracaoExport'
import * as reportsService from '../shared/services/reportsService'
import { exportToCsv } from '../shared/utils/exportTable'
import type { ProductivityReportItemDto } from '../shared/types/reports'

/** Wire de um analista sem os opcionais: as chaves NÃO VÊM (não vêm `null`). */
const semChaves = JSON.parse(
  '{"userId":7,"nome":"Ana Lima","nAtendimentos":0,"totalSegundos":0,' +
    '"ticketsAtendidos":0,"mediaTicketsUltimos3Meses":0,"extrapolouJornada":false}',
) as ProductivityReportItemDto

const completo: ProductivityReportItemDto = {
  userId: 8,
  nome: 'Bruno Reis',
  equipe: 'Equipe A',
  nAtendimentos: 4,
  totalSegundos: 7200,
  ahtSegundos: 1800,
  mediaPausas: 1.5,
  ticketsAtendidos: 3,
  mediaTicketsUltimos3Meses: 2.5,
  mediaResolvidosPorDia: 0.75,
  mediaSegundosPorTicket: 2400,
  diasUteis: 5,
  horasUteisSegundos: 144000,
  mediaOciosoSegundosPorDia: 27360,
  extrapolouJornada: false,
}

describe('mapToExportRow', () => {
  it('chave ausente: toda célula opcional sai vazia, nunca "-", NaN ou undefined', () => {
    const linha = mapToExportRow(semChaves)
    expect(linha.ahtSegundos).toBeNull()
    expect(linha.horasUteisSegundos).toBeNull()
    expect(linha.mediaSegundosPorTicket).toBeNull()
    expect(linha.mediaOciosoSegundosPorDia).toBeNull()
    expect(linha.equipe).toBe('')
    expect(linha.mediaResolvidosPorDia).toBe('')
    expect(linha.mediaPausas).toBe('')
    expect(Object.values(linha)).not.toContain('-')
    const texto = Object.values(linha).join(' | ')
    expect(texto).not.toContain('NaN')
    expect(texto).not.toContain('undefined')
    for (const col of PRODUCTIVITY_EXPORT_COLUMNS) {
      expect(Object.hasOwn(linha, col.key)).toBe(true)
    }
  })

  it('valores presentes: durações em segundos e números formatados', () => {
    const linha = mapToExportRow({ ...completo, extrapolouJornada: true })
    expect(linha.totalSegundos).toBe(7200)
    expect(linha.horasUteisSegundos).toBe(144000)
    expect(linha.mediaSegundosPorTicket).toBe(2400)
    expect(linha.mediaOciosoSegundosPorDia).toBe(27360)
    expect(linha.ticketsAtendidos).toBe('3')
    expect(linha.mediaTicketsUltimos3Meses).toBe('2,50')
    expect(linha.mediaResolvidosPorDia).toBe('0,75')
    expect(linha.jornada).toBe('Acima da jornada')
    expect(mapToExportRow(completo).jornada).toBe('')
  })

  it('`0` é valor, não ausência', () => {
    const linha = mapToExportRow({ ...completo, mediaOciosoSegundosPorDia: 0 })
    expect(linha.mediaOciosoSegundosPorDia).toBe(0)
  })
})

describe('PRODUCTIVITY_EXPORT_COLUMNS', () => {
  it('identidade do conjunto de chaves de duração', () => {
    expect(new Set(chavesDeDuracao(PRODUCTIVITY_EXPORT_COLUMNS))).toEqual(
      new Set([
        'totalSegundos',
        'horasUteisSegundos',
        'mediaSegundosPorTicket',
        'ahtSegundos',
        'mediaOciosoSegundosPorDia',
      ]),
    )
    assertCelulasDeDuracaoSaoNumericas(PRODUCTIVITY_EXPORT_COLUMNS, [
      mapToExportRow(completo),
      mapToExportRow(semChaves),
    ])
  })

  it('cabeçalhos iguais aos da tela, mais a coluna de jornada', () => {
    const daTela = productivityColumns.map((c) => c.header)
    expect(PRODUCTIVITY_EXPORT_COLUMNS.map((c) => c.header)).toEqual([...daTela, 'Jornada'])
  })
})

/** CSV gerado pelo exportTable real; só o download é encenado. */
function capturarCsv(rows: ReturnType<typeof mapToExportRow>[]): string {
  const partes: string[] = []
  const BlobOriginal = Blob
  vi.stubGlobal('Blob', function (parts: BlobPart[], options?: BlobPropertyBag) {
    if (typeof parts[0] === 'string') partes.push(parts[0])
    return new BlobOriginal(parts, options)
  })
  vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:mock'), revokeObjectURL: vi.fn() })
  vi.spyOn(document, 'createElement').mockReturnValue({
    click: vi.fn(),
    href: '',
    download: '',
    rel: '',
  } as unknown as HTMLElement)
  vi.spyOn(document.body, 'appendChild').mockImplementation(vi.fn())
  vi.spyOn(document.body, 'removeChild').mockImplementation(vi.fn())
  try {
    exportToCsv('teste', PRODUCTIVITY_EXPORT_COLUMNS, rows)
  } finally {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  }
  return partes.join('')
}

describe('exportação pelo exportTable real', () => {
  it('linha com opcionais ausentes não gera aspa antes do hífen (sanitizador de fórmula)', () => {
    const csv = capturarCsv([mapToExportRow(semChaves)])
    const linhaDeDados = csv.split(/\r?\n/)[1]

    expect(linhaDeDados.startsWith('"Ana Lima",')).toBe(true)
    expect(csv).not.toContain("'-")
    expect(linhaDeDados).toContain('"Ana Lima","","0","0","0,00",""')
  })
})

describe('fetchProductivityForExport', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('envia filtros e a ordenação da tela', async () => {
    const spy = vi.spyOn(reportsService, 'listProductivity').mockResolvedValue({
      items: [completo],
      totalCount: 1,
      page: 1,
      pageSize: 200,
      totalPages: 1,
    })

    const items = await fetchProductivityForExport(
      { from: '2026-10-01', to: '2026-10-07', teamId: '3' },
      { sortBy: 'ocioso', sortDirection: 'asc' },
    )

    expect(items).toEqual([completo])
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        from: '2026-10-01',
        to: '2026-10-07',
        teamId: '3',
        sortBy: 'ocioso',
        sortDirection: 'asc',
        page: 1,
      }),
    )
  })
})
