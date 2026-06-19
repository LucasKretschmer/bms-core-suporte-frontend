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
})
