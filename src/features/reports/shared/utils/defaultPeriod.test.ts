import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { describe, expect, it, vi, afterEach } from 'vitest'
import { endOfMonth, format, startOfMonth } from 'date-fns'
import {
  defaultCurrentMonthFullPeriod,
  defaultCurrentMonthPeriod,
} from './defaultPeriod'

describe('defaultCurrentMonthPeriod', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('retorna 1º dia do mês como from e a data de referência como to', () => {
    const ref = new Date(2026, 5, 30) // 30/06/2026 (mês 5 = junho)
    const period = defaultCurrentMonthPeriod(ref)
    expect(period.from).toBe('2026-06-01')
    expect(period.to).toBe('2026-06-30')
  })

  it('usa o relógio atual quando nenhuma referência é passada', () => {
    const today = new Date()
    const period = defaultCurrentMonthPeriod()
    expect(period.from).toBe(format(startOfMonth(today), 'yyyy-MM-dd'))
    expect(period.to).toBe(format(today, 'yyyy-MM-dd'))
  })

  it('usa fuso LOCAL (format), não UTC — sem off-by-one na virada de mês', () => {
    vi.useFakeTimers()
    // 1º dia do mês à meia-noite local: toISOString daria o dia anterior em fusos negativos.
    vi.setSystemTime(new Date(2024, 2, 1, 0, 0, 0)) // 2024-03-01 00:00 local
    const period = defaultCurrentMonthPeriod()
    expect(period.from).toBe('2024-03-01')
    expect(period.to).toBe('2024-03-01')
  })

  it('from é sempre o dia 01 do mês da referência', () => {
    const period = defaultCurrentMonthPeriod(new Date(2024, 0, 17)) // 17/01/2024
    expect(period.from).toBe('2024-01-01')
    expect(period.to).toBe('2024-01-17')
  })
})

describe('defaultCurrentMonthFullPeriod (068)', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('retorna 1º dia (from) e ÚLTIMO dia do mês (to), não "hoje"', () => {
    const ref = new Date(2024, 0, 17) // 17/01/2024
    const period = defaultCurrentMonthFullPeriod(ref)
    expect(period.from).toBe('2024-01-01')
    expect(period.to).toBe('2024-01-31') // último dia de janeiro
  })

  it('respeita meses com 30, 28 e 29 dias (ano bissexto)', () => {
    expect(defaultCurrentMonthFullPeriod(new Date(2026, 3, 10)).to).toBe('2026-04-30') // abril
    expect(defaultCurrentMonthFullPeriod(new Date(2025, 1, 10)).to).toBe('2025-02-28') // fev não bissexto
    expect(defaultCurrentMonthFullPeriod(new Date(2024, 1, 10)).to).toBe('2024-02-29') // fev bissexto
  })

  it('usa o relógio atual quando nenhuma referência é passada', () => {
    const today = new Date()
    const period = defaultCurrentMonthFullPeriod()
    expect(period.from).toBe(format(startOfMonth(today), 'yyyy-MM-dd'))
    expect(period.to).toBe(format(endOfMonth(today), 'yyyy-MM-dd'))
  })

  it('usa fuso LOCAL (format), não UTC — sem off-by-one', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2024, 2, 31, 23, 30, 0)) // 2024-03-31 23:30 local
    const period = defaultCurrentMonthFullPeriod()
    expect(period.from).toBe('2024-03-01')
    expect(period.to).toBe('2024-03-31')
  })
})

/**
 * 123/FE-FIX3 (ressalva `F-3`) — a consolidação não pode mudar o comportamento de quem
 * já usava este módulo.
 *
 * `periodoPadrao.ts` recalculava "mês corrente inteiro" com a mesma `date-fns` e o mesmo
 * `format(…, 'yyyy-MM-dd')` — duas fontes de verdade na mesma pasta. A consolidação
 * apagou a cópia e fez `resolverPeriodoPadrao` delegar para cá. Este bloco trava as
 * duas metades do risco:
 *
 *  1. **os valores não mudaram** — literais escritos à mão, incluindo os que só a cópia
 *     apagada exercitava (virada de ano às 23:30, fevereiro bissexto);
 *  2. **a lista de consumidores é DERIVADA da fonte**, não mantida à mão. Se uma tela
 *     parar de importar este módulo (ou passar a importar outra coisa para calcular o
 *     mês), a identidade abaixo fica vermelha nomeando o arquivo — que é o modo de
 *     falha que criou a duplicata em primeiro lugar.
 */
describe('123/FE-FIX3 (F-3) — os consumidores deste módulo, derivados da fonte', () => {
  const BARRA_INVERTIDA = String.fromCharCode(92)
  const EH_TESTE = /\.(test|spec)\.[cm]?[jt]sx?$/
  const EH_FONTE = /\.[cm]?[jt]sx?$/

  function listarFontes(dir: string, acc: string[] = []): string[] {
    for (const entrada of readdirSync(dir, { withFileTypes: true })) {
      const caminho = join(dir, entrada.name)
      if (entrada.isDirectory()) listarFontes(caminho, acc)
      else if (EH_FONTE.test(entrada.name)) acc.push(caminho)
    }
    return acc
  }

  /**
   * Especificadores nomeados de um `import … from '…/defaultPeriod'`.
   *
   * Casa o IMPORT, nunca o conteúdo do arquivo: mencionar `defaultCurrentMonthFullPeriod`
   * numa docstring é documentação, não dependência. Medido: com `includes` no arquivo
   * inteiro, a mutação M3 (o módulo volta a recalcular o mês e PERDE o import) passava,
   * porque a própria prosa que explica a consolidação cita o nome
   * (`AP-QA-008`: detector sobre substring reprova/aprova a própria documentação).
   */
  const REGEX_IMPORT_DEFAULT_PERIOD =
    /import\s*\{([^}]*)\}\s*from\s*['"][^'"]*\/defaultPeriod['"]/g

  function especificadoresImportados(conteudo: string): string[] {
    const nomes = new Set<string>()
    for (const m of conteudo.matchAll(REGEX_IMPORT_DEFAULT_PERIOD)) {
      for (const bruto of m[1].split(',')) {
        const nome = bruto.trim().split(/\s+as\s+/)[0].trim()
        if (nome.length > 0) nomes.add(nome)
      }
    }
    return Array.from(nomes).sort()
  }

  /** Arquivo de produção → funções de `defaultPeriod` que ele IMPORTA, derivado do fonte. */
  function derivarConsumidores(): Record<string, string[]> {
    const raiz = process.cwd()
    const consumidores: Record<string, string[]> = {}
    for (const absoluto of listarFontes(resolve(raiz, 'src'))) {
      const relativo = relative(raiz, absoluto).split(BARRA_INVERTIDA).join('/')
      if (EH_TESTE.test(relativo)) continue
      if (relativo.endsWith('shared/utils/defaultPeriod.ts')) continue // o próprio módulo
      const usadas = especificadoresImportados(readFileSync(absoluto, 'utf8'))
      if (usadas.length > 0) consumidores[relativo] = usadas
    }
    return consumidores
  }

  const CONSUMIDORES = derivarConsumidores()

  it('a varredura acha consumidores de verdade (não é uma regex morta)', () => {
    // Sem este controle positivo, a identidade abaixo passaria com o mapa vazio.
    expect(Object.keys(CONSUMIDORES).length).toBeGreaterThan(5)
  })

  it('o detector casa o IMPORT e ignora a menção em prosa', () => {
    // Positivo: import real, em qualquer profundidade de caminho.
    expect(
      especificadoresImportados(
        "import { defaultCurrentMonthFullPeriod } from '../../shared/utils/defaultPeriod'",
      ),
    ).toEqual(['defaultCurrentMonthFullPeriod'])
    expect(
      especificadoresImportados(
        `import {
  defaultCurrentMonthFullPeriod,
  defaultCurrentMonthPeriod,
} from './defaultPeriod'`,
      ),
    ).toEqual(['defaultCurrentMonthFullPeriod', 'defaultCurrentMonthPeriod'])
    // Negativo: prosa citando o nome NUNCA vira dependência (foi o falso negativo medido
    // na mutação M3 quando o detector olhava o arquivo inteiro).
    expect(
      especificadoresImportados(
        '/** delega a `defaultCurrentMonthFullPeriod`, de `./defaultPeriod.ts` */',
      ),
    ).toEqual([])
    // Negativo: import de OUTRO módulo com nome parecido não entra.
    expect(
      especificadoresImportados("import { algo } from './defaultPeriodoOutro'"),
    ).toEqual([])
  })

  it('🔴 o conjunto de consumidores é exatamente este (identidade, não contagem)', () => {
    expect(CONSUMIDORES).toEqual({
      // ── as telas que já usavam o helper antes da 123 ──
      'src/features/dashboards/onboarding/index.tsx': ['defaultCurrentMonthPeriod'],
      'src/features/dashboards/support/index.tsx': ['defaultCurrentMonthPeriod'],
      'src/features/movimentacao-diaria/hooks/useMovimentacaoDiariaLogs.ts': [
        'defaultCurrentMonthPeriod',
      ],
      'src/features/reports/appointments/hooks/useAppointments.ts': ['defaultCurrentMonthPeriod'],
      'src/features/reports/plan-consumption/hooks/usePlanConsumption.ts': [
        'defaultCurrentMonthPeriod',
      ],
      'src/features/reports/productivity/hooks/useProductivity.ts': ['defaultCurrentMonthPeriod'],
      'src/features/reports/project-appointments/hooks/useProjectAppointments.ts': [
        'defaultCurrentMonthPeriod',
      ],
      'src/features/reports/client-report/hooks/useClientReport.ts': [
        'defaultCurrentMonthFullPeriod',
      ],
      // ── 123/FE-FIX3: os dois módulos que passaram a DELEGAR em vez de recalcular ──
      'src/features/reports/shared/utils/periodoPadrao.ts': ['defaultCurrentMonthFullPeriod'],
      'src/features/reports/shared/utils/competenciaTexts.ts': ['defaultCurrentMonthFullPeriod'],
    })
  })

  it('nenhum consumidor recalcula o mês por conta própria (startOfMonth/endOfMonth solto)', () => {
    // A duplicata que a F-3 achou tinha exatamente esta forma: `format(startOfMonth(x))`
    // dentro de outro arquivo da mesma pasta. Aqui só `defaultPeriod.ts` pode fazê-lo.
    const raiz = process.cwd()
    const infratores: string[] = []
    for (const absoluto of listarFontes(resolve(raiz, 'src'))) {
      const relativo = relative(raiz, absoluto).split(BARRA_INVERTIDA).join('/')
      if (EH_TESTE.test(relativo)) continue
      if (relativo.endsWith('shared/utils/defaultPeriod.ts')) continue
      const conteudo = readFileSync(absoluto, 'utf8')
      if (/\bformat\(\s*(startOfMonth|endOfMonth)\(/.test(conteudo)) infratores.push(relativo)
    }
    expect(
      infratores,
      'Estes arquivos recalculam o mês corrente em vez de usar `defaultPeriod.ts`. ' +
        'Foi assim que a F-3 nasceu — estenda o módulo existente, não crie um segundo.',
    ).toEqual([])

    // Controle positivo: o detector ainda pega a forma que ele existe para proibir.
    expect(/\bformat\(\s*(startOfMonth|endOfMonth)\(/.test("format(startOfMonth(ref), 'yyyy-MM-dd')")).toBe(
      true,
    )
    // E é PRECISO: não acusa quem usa as funções por outros motivos.
    expect(/\bformat\(\s*(startOfMonth|endOfMonth)\(/.test('const inicio = startOfMonth(ref)')).toBe(
      false,
    )
  })

  it('os valores continuam os mesmos depois da consolidação (literais à mão)', () => {
    // Casos que só a cópia apagada exercitava — trazidos para o dono do conceito.
    expect(defaultCurrentMonthFullPeriod(new Date(2026, 11, 31, 23, 30))).toEqual({
      from: '2026-12-01',
      to: '2026-12-31',
    })
    expect(defaultCurrentMonthFullPeriod(new Date(2026, 8, 15, 12, 0, 0))).toEqual({
      from: '2026-09-01',
      to: '2026-09-30',
    })
    expect(defaultCurrentMonthFullPeriod(new Date(2028, 1, 5))).toEqual({
      from: '2028-02-01',
      to: '2028-02-29',
    })
    // `defaultCurrentMonthPeriod` (01 → hoje) NÃO foi tocado — as 8 telas que o usam
    // continuam com o fim em "hoje", não no último dia do mês.
    expect(defaultCurrentMonthPeriod(new Date(2026, 8, 15))).toEqual({
      from: '2026-09-01',
      to: '2026-09-15',
    })
  })
})
