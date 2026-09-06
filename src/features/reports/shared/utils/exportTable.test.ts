import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest'

/**
 * Espião do `exceljs` (achado `B-1` da auditoria de segurança da 123).
 *
 * Este arquivo importa `exportTable` **de verdade** — é o ponto todo. Os 6 arquivos que
 * exercitavam `exportToXlsx` mockavam o módulo `exportTable` INTEIRO (legítimo em cada um:
 * evita o import lazy do `exceljs` em jsdom) e, somados, deixavam `sanitizeXlsxCell` sem um
 * único teste: apagá-la mantinha a suíte verde. Aqui só o `exceljs` é substituído, e por um
 * espião que REGISTRA as células recebidas — nunca por um mock que lança, que o
 * `try/catch` do chamador engoliria.
 */
const exceljs = vi.hoisted(() => ({
  celulasAdicionadas: [] as unknown[][],
  cabecalhosDeclarados: [] as unknown[],
  writeBufferChamado: 0,
}))

vi.mock('exceljs', () => {
  class PlanilhaFake {
    set columns(cols: unknown[]) {
      exceljs.cabecalhosDeclarados = cols
    }
    getRow(): Record<string, unknown> {
      return {}
    }
    addRow(celulas: unknown[]): void {
      exceljs.celulasAdicionadas.push(celulas)
    }
  }
  class WorkbookFake {
    xlsx = {
      writeBuffer: async (): Promise<ArrayBuffer> => {
        exceljs.writeBufferChamado += 1
        return new ArrayBuffer(8)
      },
    }
    addWorksheet(): PlanilhaFake {
      return new PlanilhaFake()
    }
  }
  return { default: { Workbook: WorkbookFake } }
})

import { exportToCsv, exportToXlsx, type ExportColumn, type ExportRow } from './exportTable'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('exportToCsv', () => {
  function setupExportMocks() {
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:mock'),
      revokeObjectURL: vi.fn(),
    })
    const mockClick = vi.fn()
    vi.spyOn(document, 'createElement').mockReturnValue({
      click: mockClick,
      href: '',
      download: '',
      rel: '',
    } as unknown as HTMLElement)
    vi.spyOn(document.body, 'appendChild').mockImplementation(vi.fn())
    vi.spyOn(document.body, 'removeChild').mockImplementation(vi.fn())
    return mockClick
  }

  it('exporta CSV e aciona download', () => {
    const mockClick = setupExportMocks()

    const columns: ExportColumn[] = [
      { header: 'Ticket', key: 'ticket' },
      { header: 'Atendente', key: 'atendente' },
    ]
    const rows: ExportRow[] = [{ ticket: '12345', atendente: 'João' }]

    exportToCsv('teste', columns, rows)
    expect(mockClick).toHaveBeenCalledOnce()

    vi.unstubAllGlobals()
  })

  it('não inclui coluna "categoria" quando não definida em ExportColumn', () => {
    // O teste verifica que a função só usa as colunas passadas em ExportColumn.
    // Se "categoria" não está em columns, não pode estar no CSV.
    const columns: ExportColumn[] = [
      { header: 'Ticket', key: 'hubspotTicketId' },
      { header: 'Atendente', key: 'atendente' },
      { header: 'Faturamento', key: 'faturamento' },
      // "categoria" deliberadamente ausente — campo privado
    ]

    const rows: ExportRow[] = [
      {
        hubspotTicketId: '12345',
        atendente: 'João',
        faturamento: 'Plano de Suporte',
        // Campo interno não listado em columns → não deve sair no CSV
        categoria: 'Problema - Invoicy',
      },
    ]

    // Captura o conteúdo do CSV inspecionando o Blob
    const capturedParts: string[] = []
    const OriginalBlob = Blob
    vi.stubGlobal('Blob', function (parts: BlobPart[], options?: BlobPropertyBag) {
      if (parts && typeof parts[0] === 'string') capturedParts.push(parts[0] as string)
      return new OriginalBlob(parts, options)
    })
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:mock'),
      revokeObjectURL: vi.fn(),
    })
    vi.spyOn(document, 'createElement').mockReturnValue({ click: vi.fn(), href: '', download: '', rel: '' } as unknown as HTMLElement)
    vi.spyOn(document.body, 'appendChild').mockImplementation(vi.fn())
    vi.spyOn(document.body, 'removeChild').mockImplementation(vi.fn())

    exportToCsv('relatorio', columns, rows)

    const csvContent = capturedParts.join('')
    expect(csvContent).not.toContain('Problema - Invoicy')
    expect(csvContent).not.toContain('categoria')
    // Os campos que estão em columns devem aparecer
    expect(csvContent).toContain('Ticket')
    expect(csvContent).toContain('Faturamento')

    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  describe('hardening contra CSV/Formula injection (A03)', () => {
    function captureCsv(columns: ExportColumn[], rows: ExportRow[]): string {
      const capturedParts: string[] = []
      const OriginalBlob = Blob
      vi.stubGlobal('Blob', function (parts: BlobPart[], options?: BlobPropertyBag) {
        if (parts && typeof parts[0] === 'string') capturedParts.push(parts[0] as string)
        return new OriginalBlob(parts, options)
      })
      vi.stubGlobal('URL', {
        createObjectURL: vi.fn(() => 'blob:mock'),
        revokeObjectURL: vi.fn(),
      })
      vi.spyOn(document, 'createElement').mockReturnValue({
        click: vi.fn(),
        href: '',
        download: '',
        rel: '',
      } as unknown as HTMLElement)
      vi.spyOn(document.body, 'appendChild').mockImplementation(vi.fn())
      vi.spyOn(document.body, 'removeChild').mockImplementation(vi.fn())

      exportToCsv('teste', columns, rows)

      vi.unstubAllGlobals()
      vi.restoreAllMocks()
      return capturedParts.join('')
    }

    const columns: ExportColumn[] = [{ header: 'Assunto', key: 'assunto' }]

    it('prefixa aspa simples em célula iniciando com "="', () => {
      const csv = captureCsv(columns, [{ assunto: '=SUM(A1:A2)' }])
      expect(csv).toContain(`"'=SUM(A1:A2)"`)
    })

    it('prefixa aspa simples em célula iniciando com "+", "-" e "@"', () => {
      expect(captureCsv(columns, [{ assunto: '+1' }])).toContain(`"'+1"`)
      expect(captureCsv(columns, [{ assunto: '-1+1' }])).toContain(`"'-1+1"`)
      expect(captureCsv(columns, [{ assunto: '@cmd' }])).toContain(`"'@cmd"`)
    })

    it('não prefixa células seguras', () => {
      const csv = captureCsv(columns, [{ assunto: 'Texto normal' }])
      expect(csv).toContain(`"Texto normal"`)
      expect(csv).not.toContain(`"'Texto normal"`)
    })

    it('mantém o BOM UTF-8 para acentos abrirem no Excel pt-BR', () => {
      const csv = captureCsv(columns, [{ assunto: 'Configuração' }])
      expect(csv.charCodeAt(0)).toBe(0xfeff)
      expect(csv).toContain('Configuração')
    })

    it('escapa aspas duplas e remove quebras de linha', () => {
      const csv = captureCsv(columns, [{ assunto: 'Linha 1\nLinha 2 "com aspas"' }])
      expect(csv).toContain(`"Linha 1 Linha 2 ""com aspas"""`)
    })
  })
})

describe('exportToXlsx — hardening contra Formula injection no XLSX (A03 · B-1)', () => {
  const colunas: ExportColumn[] = [{ header: 'Assunto', key: 'assunto' }]

  beforeEach(() => {
    exceljs.celulasAdicionadas = []
    exceljs.cabecalhosDeclarados = []
    exceljs.writeBufferChamado = 0
  })

  /**
   * Só o DOWNLOAD é encenado (mesmo padrão dos casos de CSV acima): sem isso o `a.click()`
   * real faz o jsdom logar `Not implemented: navigation to another Document` a cada caso.
   * `exportToXlsx` e `sanitizeXlsxCell` são os de verdade — é o ponto do `B-1`.
   */
  async function exportarXlsx(columns: ExportColumn[], rows: ExportRow[]): Promise<void> {
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:mock'),
      revokeObjectURL: vi.fn(),
    })
    vi.spyOn(document, 'createElement').mockReturnValue({
      click: vi.fn(),
      href: '',
      download: '',
      rel: '',
    } as unknown as HTMLElement)
    vi.spyOn(document.body, 'appendChild').mockImplementation(vi.fn())
    vi.spyOn(document.body, 'removeChild').mockImplementation(vi.fn())
    try {
      await exportToXlsx('teste', columns, rows)
    } finally {
      vi.unstubAllGlobals()
      vi.restoreAllMocks()
    }
  }

  it('prefixa aspa simples em célula iniciando com "=", "+", "-", "@", TAB e CR', async () => {
    const rows: ExportRow[] = [
      { assunto: "=cmd|' /C calc'!A0" },
      { assunto: '+1+1' },
      { assunto: '-1+1' },
      { assunto: '@SUM(1)' },
      { assunto: '\tSUM(1)' },
      { assunto: '\r=SUM(1)' },
    ]

    await exportarXlsx(colunas, rows)

    // Controle positivo do espião ANTES do conteúdo: se o caminho do XLSX não tivesse sido
    // percorrido, o array ficaria vazio e qualquer asserção sobre "o que saiu" seria
    // satisfeita pelo vazio (`rules/tests.md` § padrão 1).
    expect(exceljs.celulasAdicionadas).toHaveLength(6)
    expect(exceljs.writeBufferChamado).toBe(1)

    // Literais escritos à mão — nada derivado de `rows`.
    expect(exceljs.celulasAdicionadas.map((linha) => linha[0])).toEqual([
      "'=cmd|' /C calc'!A0",
      "'+1+1",
      "'-1+1",
      "'@SUM(1)",
      "'\tSUM(1)",
      "'\r=SUM(1)",
    ])
  })

  it('sanitiza TODAS as colunas da linha, não só a primeira', async () => {
    await exportarXlsx(
      [
        { header: 'A', key: 'a' },
        { header: 'B', key: 'b' },
      ],
      [{ a: '=A1', b: '=B1' }],
    )

    expect(exceljs.celulasAdicionadas).toEqual([["'=A1", "'=B1"]])
  })

  it('não altera célula segura, preserva número e normaliza ausência — com controle positivo na mesma execução', async () => {
    await exportarXlsx(colunas, [
      { assunto: 'Cliente X' },
      { assunto: 42 },
      { assunto: null },
      { assunto: undefined },
      // Controle positivo: uma célula que a sanitização AINDA neutraliza, na mesma
      // execução. Sem ela, este caso continuaria verde se a sanitização sumisse — e
      // "não prefixou o que é seguro" viraria uma afirmação sobre um teste morto.
      { assunto: '=1+1' },
    ])

    expect(exceljs.celulasAdicionadas.map((linha) => linha[0])).toEqual([
      'Cliente X',
      42,
      '',
      '',
      "'=1+1",
    ])
  })

  it('o cabeçalho declarado é o das colunas passadas — o XLSX não inventa coluna', async () => {
    await exportarXlsx(colunas, [{ assunto: 'ok' }])

    expect(exceljs.cabecalhosDeclarados).toEqual([
      expect.objectContaining({ header: 'Assunto', key: 'assunto' }),
    ])
  })
})
