import { describe, expect, it, vi, afterEach } from 'vitest'
import { exportToCsv, type ExportColumn, type ExportRow } from './exportTable'

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
