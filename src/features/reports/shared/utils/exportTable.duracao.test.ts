/**
 * Demanda 134 · Horas em formato calculável no export CSV/Excel — NÚCLEO (U0).
 *
 * 🔴 Arquivo SEPARADO de `exportTable.test.ts` de propósito: aquele faz `vi.mock('exceljs')`
 * com um fake, e `vi.mock` é de escopo de arquivo. Com o fake no ar seria impossível reler o
 * buffer — os casos "arquivo gerado" estariam testando o fake, não o exceljs.
 * Aqui o exceljs é o REAL (4.4.0), o `.xlsx` é escrito em memória e RELIDO.
 *
 * Sobre a releitura (achado da análise §4.3): o exceljs, ao LER, converte célula numérica
 * cujo `numFmt` "pareça data" em `Date` (`isDateFmt` remove o que está entre `[]` e casa
 * `m`/`s`). Logo `cell.value` volta como `Date` com época 1899-12-30 — não como number.
 * Os literais ISO abaixo são escritos à mão; o dia +1 em `1899-12-31T02:30:00.000Z` é
 * exatamente o que prova o "sem módulo 24". Não "consertar" para 1899-12-30.
 */

import { describe, expect, it, vi } from 'vitest'
import ExcelJS from 'exceljs'
import {
  durationCell,
  durationCellFromHours,
  durationCellFromMillis,
  durationToExcelSerial,
  exportToCsv,
  exportToXlsx,
  formatDurationCsv,
  type ExportColumn,
  type ExportRow,
} from './exportTable'
import { assertCelulasDeDuracaoSaoNumericas, chavesDeDuracao } from '../../../../test/duracaoExport'

// ── Encenação do download (mesmo padrão dos testes já existentes) ─────────────

function encenarDownload(): void {
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
}

function capturarCsv(columns: ExportColumn[], rows: ExportRow[]): string {
  const partes: string[] = []
  const BlobOriginal = Blob
  vi.stubGlobal('Blob', function (parts: BlobPart[], options?: BlobPropertyBag) {
    if (parts && typeof parts[0] === 'string') partes.push(parts[0] as string)
    return new BlobOriginal(parts, options)
  })
  encenarDownload()
  try {
    exportToCsv('teste', columns, rows)
  } finally {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  }
  return partes.join('')
}

/** Linhas do CSV já sem o BOM: `[0]` = cabeçalho, `[1..]` = dados. */
function linhasCsv(csv: string): string[] {
  return csv.replace(/^﻿/, '').split('\n')
}

type PlanilhaRelida = {
  planilha: ExcelJS.Worksheet
  /** Controle positivo do capturador: quantos Blobs o export produziu. */
  buffersCapturados: number
}

async function capturarXlsx(columns: ExportColumn[], rows: ExportRow[]): Promise<PlanilhaRelida> {
  const partes: BlobPart[] = []
  const BlobOriginal = Blob
  vi.stubGlobal('Blob', function (parts: BlobPart[], options?: BlobPropertyBag) {
    if (parts && parts[0] != null) partes.push(parts[0])
    return new BlobOriginal(parts, options)
  })
  encenarDownload()
  try {
    await exportToXlsx('teste', columns, rows)
  } finally {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  }

  const workbook = new ExcelJS.Workbook()
  // O bundle browser do exceljs devolve `Uint8Array` no `writeBuffer` (verificado neste
  // ambiente); `load` o aceita direto.
  await workbook.xlsx.load(partes[0] as Parameters<typeof workbook.xlsx.load>[0])
  const planilha = workbook.getWorksheet('teste')
  if (!planilha) throw new Error('planilha "teste" não veio no arquivo gerado')
  return { planilha, buffersCapturados: partes.length }
}

const COL_DUR: ExportColumn[] = [{ header: 'Tempo', key: 'tempo', type: 'duration' }]

// ── N1-N4 · formatDurationCsv ────────────────────────────────────────────────

describe('formatDurationCsv (N1-N4)', () => {
  it('N1 · 9840 s → "02:44:00" (zero à esquerda nas horas < 10)', () => {
    expect(formatDurationCsv(9840)).toBe('02:44:00')
  })

  it('N2 · 95400 s → "26:30:00" — SEM módulo 24', () => {
    expect(formatDurationCsv(95400)).toBe('26:30:00')
    // Companheira: três dígitos de hora também não estouram.
    expect(formatDurationCsv(360000)).toBe('100:00:00')
    expect(formatDurationCsv(359999)).toBe('99:59:59')
  })

  it('N3 · 0 s é VALOR, não ausência → "00:00:00"', () => {
    expect(formatDurationCsv(0)).toBe('00:00:00')
  })

  it('N4 · negativo clampa em 0 → "00:00:00" (nunca "-1:00:00")', () => {
    expect(formatDurationCsv(-3600)).toBe('00:00:00')
  })
})

// ── N5-N6 · durationToExcelSerial ────────────────────────────────────────────

describe('durationToExcelSerial (N5-N6)', () => {
  it('N5 · 9840 s → 0,1138889 de dia', () => {
    expect(durationToExcelSerial(9840)).toBeCloseTo(0.1138889, 7)
  })

  it('N6 · 95400 s → 1,1041667 de dia (passa de 24 h)', () => {
    expect(durationToExcelSerial(95400)).toBeCloseTo(1.1041667, 7)
  })

  it('negativo clampa em 0', () => {
    expect(durationToExcelSerial(-60)).toBe(0)
  })
})

// ── N7-N12 · os três helpers de célula ───────────────────────────────────────

describe('durationCell / …FromHours / …FromMillis (N7-N12)', () => {
  /**
   * 🔴 **O comentário antigo desta linha era FALSO** (*"o caso `null` é o que discrimina"*), e o
   * QA da 134 provou (achado **I-01**): dentro de `coerceDurationCell` o guard `value == null`
   * é **DOMINADO** pela linha seguinte — `Number.isFinite(null)` e `Number.isFinite(undefined)`
   * já são `false`, então trocar o guard por `=== undefined`, ou **apagá-lo por inteiro**, não
   * muda o retorno desta função para nenhuma entrada. Nenhum teste de caixa-preta pode
   * detectar aquela mutação AQUI, e afirmar que este caso a detecta é a mentira que o
   * comentário contava.
   *
   * Quem discrimina `== null` × `=== undefined` de verdade é **N15** (CSV, com espião de lista)
   * e **N19** (XLSX relido), em `normalizeDurationSeconds` — lá o `typeof value !== 'number'`
   * vem ANTES do `Number.isFinite`, e `null` cairia no fallback ruidoso.
   *
   * O que ESTES casos existem para deixar vermelho — defeitos possíveis neste nível:
   *  · ausência colapsada em zero (`value ?? 0`) → a planilha afirmaria "zero" onde o valor é
   *    DESCONHECIDO (`AP-FRONTEND-028`). A companheira positiva `0 → 0` está na MESMA asserção,
   *    então a troca não passa por simetria;
   *  · devolver `undefined` em vez de `null` → o núcleo trataria como "não é duração" e o dado
   *    sairia pelo FALLBACK ruidoso (o espião de lista abaixo pega, e ele é o discriminador);
   *  · o EFEITO no arquivo: ausência é célula **vazia**, nunca `'—'`, nunca `'00:00:00'`.
   *    N15 escreve valores CRUS na linha; aqui o caminho é **helper → export**, que é como as
   *    12 superfícies escrevem de verdade.
   */
  it('N7 · ausência (`null` explícito e `undefined`) → null, e no CSV vira célula VAZIA', () => {
    expect(durationCell(null)).toBeNull()
    expect(durationCell(undefined)).toBeNull()
    // Companheira positiva na MESMA asserção: `0` é valor, e continua sendo.
    expect(durationCell(0)).toBe(0)

    const erros: string[] = []
    vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      erros.push(args.map(String).join(' '))
    })
    const csv = capturarCsv(
      [
        { header: 'A', key: 'a', type: 'duration' },
        { header: 'B', key: 'b', type: 'duration' },
        { header: 'C', key: 'c', type: 'duration' },
      ],
      [{ a: durationCell(null), b: durationCell(undefined), c: durationCell(0) }],
    )
    expect(linhasCsv(csv)[1]).toBe('"","","00:00:00"')
    expect(csv).not.toContain('—')
    // Espião com LISTA (nunca `throw`): se o helper devolvesse `undefined`, o valor cairia no
    // fallback e haveria `console.error`. O controle positivo do espião é T-FALLBACK.
    expect(erros).toEqual([])
  })

  it('N8 · 0 → 0 (companheira positiva de N7: ausência ≠ zero)', () => {
    expect(durationCell(0)).toBe(0)
  })

  it('N9 · NaN e ±Infinity → null (nunca viajam para a planilha)', () => {
    expect(durationCell(Number.NaN)).toBeNull()
    expect(durationCell(Number.POSITIVE_INFINITY)).toBeNull()
    expect(durationCell(Number.NEGATIVE_INFINITY)).toBeNull()
  })

  it('negativo → 0, e valor comum passa intacto', () => {
    expect(durationCell(-1800)).toBe(0)
    expect(durationCell(9840)).toBe(9840)
  })

  it('N10 · horas decimais 2,7333333 → 9840 s (Math.round, não floor)', () => {
    expect(durationCellFromHours(2.7333333)).toBe(9840)
    expect(durationCellFromHours(26.5)).toBe(95400)
    expect(durationCellFromHours(0)).toBe(0)
    expect(durationCellFromHours(-2)).toBe(0)
  })

  /**
   * Mesma correção de N7 (achado **I-01**): este caso **não** discrimina `== null` ×
   * `=== undefined` — o guard é dominado por `Number.isFinite`. Ele discrimina o ramo de
   * HORAS: ausência virando `0` (a planilha do plano afirmaria "nenhuma hora contratada"),
   * `NaN` viajando para a célula (vira `#VALOR!` no Excel) e o helper devolvendo `undefined`
   * (fallback ruidoso). `0 h` é valor e sai `00:00:00` — na mesma linha, para que ausência e
   * zero não possam ser trocados um pelo outro sem ficar vermelho.
   */
  it('N11 · horas: ausência e NaN → null; `0 h` é valor e vira "00:00:00" na mesma linha', () => {
    expect(durationCellFromHours(null)).toBeNull()
    expect(durationCellFromHours(undefined)).toBeNull()
    expect(durationCellFromHours(Number.NaN)).toBeNull()
    expect(durationCellFromHours(0)).toBe(0)

    const erros: string[] = []
    vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      erros.push(args.map(String).join(' '))
    })
    const csv = capturarCsv(
      [
        { header: 'A', key: 'a', type: 'duration' },
        { header: 'B', key: 'b', type: 'duration' },
      ],
      [{ a: durationCellFromHours(null), b: durationCellFromHours(0) }],
    )
    expect(linhasCsv(csv)[1]).toBe('"","00:00:00"')
    expect(erros).toEqual([])
  })

  it('N12 · 45.000 ms → 45 s; `null` explícito → null', () => {
    expect(durationCellFromMillis(45_000)).toBe(45)
    expect(durationCellFromMillis(1_499)).toBe(1)
    expect(durationCellFromMillis(0)).toBe(0)
    expect(durationCellFromMillis(null)).toBeNull()
    expect(durationCellFromMillis(undefined)).toBeNull()
  })
})

// ── N13-N15 · CSV ponta a ponta ──────────────────────────────────────────────

describe('exportToCsv · coluna de duração (N13-N15)', () => {
  const colunas: ExportColumn[] = [
    { header: 'Cliente', key: 'cliente' },
    { header: 'Tempo', key: 'tempo', type: 'duration' },
  ]

  it('N13 · converte a coluna de duração e deixa a de texto intacta na mesma linha', () => {
    const csv = capturarCsv(colunas, [{ cliente: 'Cliente X', tempo: 9840 }])
    expect(linhasCsv(csv)[1]).toBe('"Cliente X","02:44:00"')
  })

  it('N14 · > 24 h no CSV → "26:30:00"', () => {
    const csv = capturarCsv(colunas, [{ cliente: 'Cliente X', tempo: 95400 }])
    expect(linhasCsv(csv)[1]).toBe('"Cliente X","26:30:00"')
    expect(csv).not.toContain('02:30:00')
  })

  it('N15 · `null` explícito e `undefined` → célula VAZIA; `0` na mesma linha → "00:00:00"', () => {
    const colunasTriplas: ExportColumn[] = [
      { header: 'A', key: 'a', type: 'duration' },
      { header: 'B', key: 'b', type: 'duration' },
      { header: 'C', key: 'c', type: 'duration' },
    ]
    // Espião com LISTA (nunca `raise`): ausência é caminho NORMAL, não fallback. Sem esta
    // asserção, trocar o guard `== null` por `=== undefined` deixaria `null` cair no ramo
    // de fallback — que produz '' por coincidência (`String(null ?? '')`) e manteria a
    // linha idêntica. O controle positivo do espião é T-FALLBACK, no mesmo arquivo.
    const erros: string[] = []
    vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      erros.push(args.map(String).join(' '))
    })

    const csv = capturarCsv(colunasTriplas, [{ a: null, b: undefined, c: 0 }])
    expect(linhasCsv(csv)[1]).toBe('"","","00:00:00"')
    expect(erros).toEqual([])
    // Ausência nunca vira travessão numa coluna de duração.
    expect(csv).not.toContain('—')
  })

  it('coluna SEM `type` continua saindo exatamente como hoje (não-regressão)', () => {
    const csv = capturarCsv(
      [
        { header: 'Tempo', key: 'tempo' },
        { header: 'Cliente', key: 'cliente' },
      ],
      [{ tempo: 9840, cliente: null }],
    )
    expect(linhasCsv(csv)[1]).toBe('"9840",""')
  })
})

// ── N16-N21 · XLSX relido (arquivo gerado) ───────────────────────────────────

describe('exportToXlsx · coluna de duração, arquivo RELIDO (N16-N21)', () => {
  const colunas: ExportColumn[] = [
    { header: 'Cliente', key: 'cliente' },
    { header: 'Tempo', key: 'tempo', type: 'duration' },
  ]

  it(
    'N16/N20/N21 · 9840 s vira número + numFmt "[h]:mm:ss"; a coluna de texto vizinha não é contaminada',
    async () => {
      const { planilha, buffersCapturados } = await capturarXlsx(colunas, [
        { cliente: 'Cliente X', tempo: 9840 },
      ])

      // N21 · controle positivo do capturador ANTES do conteúdo: sem ele, N16-N20 seriam
      // satisfeitos pelo vazio (`rules/tests.md` § padrão 1).
      expect(buffersCapturados).toBe(1)
      expect(planilha.rowCount).toBe(2)

      const celulaTempo = planilha.getRow(2).getCell(2)
      expect(celulaTempo.numFmt).toBe('[h]:mm:ss')
      expect((celulaTempo.value as Date).toISOString()).toBe('1899-12-30T02:44:00.000Z')

      // N20 · o numFmt não vazou para a linha/coluna inteira nem para o cabeçalho.
      const celulaTexto = planilha.getRow(2).getCell(1)
      expect(celulaTexto.value).toBe('Cliente X')
      expect(celulaTexto.numFmt).toBeUndefined()
      expect(planilha.getRow(1).getCell(2).numFmt).toBeUndefined()
      expect(planilha.getRow(1).getCell(2).value).toBe('Tempo')
    },
    30_000,
  )

  it(
    'N17 · > 24 h: o serial passa de um dia (1899-12-31) — prova de que não há módulo 24',
    async () => {
      const { planilha, buffersCapturados } = await capturarXlsx(colunas, [
        { cliente: 'Cliente X', tempo: 95400 },
      ])
      expect(buffersCapturados).toBe(1)

      const celula = planilha.getRow(2).getCell(2)
      expect(celula.numFmt).toBe('[h]:mm:ss')
      expect((celula.value as Date).toISOString()).toBe('1899-12-31T02:30:00.000Z')
    },
    30_000,
  )

  it(
    'N18/N19 · `0` legítimo sai com valor e formato; `null` explícito sai como célula VAZIA',
    async () => {
      const { planilha, buffersCapturados } = await capturarXlsx(colunas, [
        { cliente: 'Zero', tempo: 0 },
        { cliente: 'Ausente', tempo: null },
        { cliente: 'Indefinido', tempo: undefined },
      ])
      expect(buffersCapturados).toBe(1)
      expect(planilha.rowCount).toBe(4)

      // N18 · zero é valor.
      const zero = planilha.getRow(2).getCell(2)
      expect(zero.numFmt).toBe('[h]:mm:ss')
      expect((zero.value as Date).toISOString()).toBe('1899-12-30T00:00:00.000Z')

      // N19 · ausência é célula vazia — nunca '', nunca 0, nunca '—'.
      for (const linha of [3, 4]) {
        const ausente = planilha.getRow(linha).getCell(2)
        expect(ausente.value).toBeNull()
        expect(ausente.type).toBe(ExcelJS.ValueType.Null)
        // A linha existe (o texto vizinho está lá): a asserção acima não é satisfeita
        // por uma planilha que simplesmente não tem essa linha.
        expect(planilha.getRow(linha).getCell(1).value).toBe(
          linha === 3 ? 'Ausente' : 'Indefinido',
        )
      }
    },
    30_000,
  )

  it(
    'coluna SEM `type` com número continua número cru, sem numFmt (não-regressão)',
    async () => {
      const { planilha } = await capturarXlsx(
        [{ header: 'Quantidade', key: 'qtd' }],
        [{ qtd: 9840 }],
      )
      const celula = planilha.getRow(2).getCell(1)
      expect(celula.value).toBe(9840)
      expect(celula.numFmt).toBeUndefined()
    },
    30_000,
  )
})

// ── A03 · a proteção contra formula injection não pode ter ganhado bypass ────

describe('A03 · o ramo de duração não abre bypass de formula injection', () => {
  it('T-A03-DUR-CSV · string "=SUM(A1:A2)" numa coluna de duração continua prefixada', () => {
    const erros: string[] = []
    vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      erros.push(args.map(String).join(' '))
    })

    const csv = capturarCsv(COL_DUR, [{ tempo: '=SUM(A1:A2)' }])

    expect(csv).toContain(`"'=SUM(A1:A2)"`)
    // Fallback RUIDOSO: o dado não é descartado, mas o call site é denunciado.
    expect(erros).toHaveLength(1)
    expect(erros[0]).toContain('tempo')
  })

  it('T-A03-DUR-CSV · os demais gatilhos (+, -, @) também continuam prefixados', () => {
    vi.spyOn(console, 'error').mockImplementation(vi.fn())
    expect(capturarCsv(COL_DUR, [{ tempo: '+1' }])).toContain(`"'+1"`)
    expect(capturarCsv(COL_DUR, [{ tempo: '-1+1' }])).toContain(`"'-1+1"`)
    expect(capturarCsv(COL_DUR, [{ tempo: '@cmd' }])).toContain(`"'@cmd"`)
    // Controle positivo na mesma execução: o que é seguro NÃO é prefixado.
    const seguro = capturarCsv(COL_DUR, [{ tempo: 9840 }])
    expect(seguro).toContain(`"02:44:00"`)
    expect(seguro).not.toContain(`"'02:44:00"`)
  })

  it(
    'T-A03-DUR-XLSX · string "=SUM(A1:A2)" numa coluna de duração vai sanitizada ao arquivo',
    async () => {
      const erros: string[] = []
      vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
        erros.push(args.map(String).join(' '))
      })

      const { planilha } = await capturarXlsx(COL_DUR, [
        { tempo: '=SUM(A1:A2)' },
        { tempo: 9840 }, // controle positivo: o caminho numérico segue funcionando
      ])

      const celula = planilha.getRow(2).getCell(1)
      expect(celula.value).toBe(`'=SUM(A1:A2)`)
      expect(celula.numFmt).toBeUndefined() // texto não recebe formato de duração
      expect((planilha.getRow(3).getCell(1).value as Date).toISOString()).toBe(
        '1899-12-30T02:44:00.000Z',
      )
      expect(erros).toHaveLength(1)
      expect(erros[0]).toContain('tempo')
    },
    30_000,
  )

  it('T-FALLBACK · texto pré-formatado ("2h 44m") NÃO é descartado — sai como texto e grita', () => {
    const erros: string[] = []
    vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      erros.push(args.map(String).join(' '))
    })

    const csv = capturarCsv(COL_DUR, [{ tempo: '2h 44m' }])

    expect(linhasCsv(csv)[1]).toBe('"2h 44m"')
    expect(erros).toHaveLength(1)
    expect(erros[0]).toContain(`type:'duration'`)
  })
})

// ── Helper compartilhado das superfícies (§9.3) — precisa discriminar de verdade ──

describe('src/test/duracaoExport (helper das ondas seguintes)', () => {
  const colunas: ExportColumn[] = [
    { header: 'Cliente', key: 'cliente' },
    { header: 'Tempo', key: 'tempo', type: 'duration' },
    { header: 'Tempo total', key: 'tempoTotal', type: 'duration' },
  ]

  it('chavesDeDuracao deriva da declaração — identidade literal, não cardinalidade', () => {
    expect(new Set(chavesDeDuracao(colunas))).toEqual(new Set(['tempo', 'tempoTotal']))
    expect(chavesDeDuracao([{ header: 'Cliente', key: 'cliente' }])).toEqual([])
  })

  it('assertCelulasDeDuracaoSaoNumericas passa com number|null e REPROVA com texto', () => {
    expect(() =>
      assertCelulasDeDuracaoSaoNumericas(colunas, [
        { cliente: 'X', tempo: 9840, tempoTotal: null },
      ]),
    ).not.toThrow()

    // Mutação embutida: é este lançamento que dá poder ao invariante das superfícies.
    expect(() =>
      assertCelulasDeDuracaoSaoNumericas(colunas, [
        { cliente: 'X', tempo: '2h 44m', tempoTotal: 0 },
      ]),
    ).toThrow()
  })

  it('assertCelulasDeDuracaoSaoNumericas não é satisfeita pelo vazio', () => {
    expect(() => assertCelulasDeDuracaoSaoNumericas(colunas, [])).toThrow()
    expect(() =>
      assertCelulasDeDuracaoSaoNumericas([{ header: 'Cliente', key: 'cliente' }], [{ cliente: 'X' }]),
    ).toThrow()
  })
})
