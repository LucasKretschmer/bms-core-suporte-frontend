/**
 * Testes do OnboardingTicketSection (017 Fase D — export "Atendimentos por atendente";
 * 134 — coluna "Horas" calculável no CSV/XLSX).
 *
 * Verifica: botões de export aparecem só com dados; export usa o conjunto FILTRADO
 * já em memória (data.porAtendente), mapeado para as colunas visíveis; a coluna de
 * duração viaja como NÚMERO CRU (segundos) e a TELA continua exibindo "1h"/"30m".
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'

// Mock PARCIAL: só os dois disparadores de download são encenados (o `exportToXlsx`
// real faria `import('exceljs')`). `durationCell` fica sendo a implementação REAL —
// se fosse mockada, a asserção "horas === 3600" viraria asserção sobre o próprio
// mock, e não sobre a conversão que a demanda existe para provar.
vi.mock('../../../reports/shared/utils/exportTable', async (importOriginal) => {
  const real =
    await importOriginal<typeof import('../../../reports/shared/utils/exportTable')>()
  return { ...real, exportToCsv: vi.fn(), exportToXlsx: vi.fn() }
})

import { OnboardingTicketSection } from './OnboardingTicketSection'
import { ToastProvider } from '../../../../components/ui/Toast'
import * as exportTable from '../../../reports/shared/utils/exportTable'
import type { ExportColumn, ExportRow } from '../../../reports/shared/utils/exportTable'
import type { OnboardingTicketStatsDto } from '../../shared/types/metrics'
import {
  chavesDeDuracao,
  assertCelulasDeDuracaoSaoNumericas,
} from '../../../../test/duracaoExport'

const DATA: OnboardingTicketStatsDto = {
  emAberto: 3,
  resolvidos: 5,
  porAtendente: [
    { userId: 1, nome: 'Fulano', equipe: 'Onboarding A', nAtendimentos: 10, totalSegundos: 3600 },
    { userId: 2, nome: 'Beltrano', equipe: null, nAtendimentos: 4, totalSegundos: 1800 },
  ],
}

/**
 * `totalSegundos` é declarado `number`, mas o valor atravessa a rede: o serializador do
 * backend pode omitir a chave (→ `undefined`) ou mandar `null`. O cast existe para
 * encenar exatamente o caso `null` EXPLÍCITO (AP-FRONTEND-028) — é ele que discrimina
 * `== null` de `=== undefined`. O `0` legítimo vai na MESMA fixture: sem essa
 * companheira positiva, um `if (!v) return null` passaria despercebido.
 */
const DATA_AUSENCIA: OnboardingTicketStatsDto = {
  emAberto: 1,
  resolvidos: 1,
  porAtendente: [
    {
      userId: 7,
      nome: 'Sem dado',
      equipe: 'Onboarding B',
      nAtendimentos: 2,
      totalSegundos: null as unknown as number,
    },
    {
      userId: 8,
      nome: 'Zero legítimo',
      equipe: 'Onboarding B',
      nAtendimentos: 1,
      totalSegundos: 0,
    },
  ],
}

function renderSection(data: OnboardingTicketStatsDto | undefined = DATA) {
  return render(
    <ToastProvider>
      <OnboardingTicketSection
        data={data}
        isLoading={false}
        isError={false}
        onRetry={vi.fn()}
      />
    </ToastProvider>,
  )
}

/** Renderiza, clica em "Baixar CSV" e devolve o que o componente REALMENTE passou. */
function capturarExportCsv(data: OnboardingTicketStatsDto = DATA): {
  columns: ExportColumn[]
  rows: ExportRow[]
} {
  renderSection(data)
  fireEvent.click(screen.getByLabelText('Baixar CSV'))
  expect(exportTable.exportToCsv).toHaveBeenCalledTimes(1)
  const [, columns, rows] = vi.mocked(exportTable.exportToCsv).mock.calls[0]
  return { columns, rows }
}

/** Células de texto da linha `index` (0 = primeiro atendente) da tabela visível. */
function celulasDaLinha(index: number): string[] {
  const tabela = screen.getByRole('table', { name: 'Atendimentos por atendente' })
  const linhas = within(tabela).getAllByRole('row')
  return within(linhas[index + 1])
    .getAllByRole('cell')
    .map((c) => c.textContent?.trim() ?? '')
}

describe('OnboardingTicketSection — export', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('exibe os botões de export quando há atendentes', () => {
    renderSection()
    expect(screen.getByLabelText('Baixar CSV')).toBeInTheDocument()
    expect(screen.getByLabelText('Baixar Excel')).toBeInTheDocument()
  })

  it('não exibe botões de export quando a lista está vazia', () => {
    renderSection({ emAberto: 0, resolvidos: 0, porAtendente: [] })
    expect(screen.queryByLabelText('Baixar CSV')).not.toBeInTheDocument()
  })

  it('export CSV usa o conjunto em memória com as colunas visíveis e rank', () => {
    renderSection()
    fireEvent.click(screen.getByLabelText('Baixar CSV'))

    expect(exportTable.exportToCsv).toHaveBeenCalledTimes(1)
    const [filename, columns, rows] = vi.mocked(exportTable.exportToCsv).mock.calls[0]
    expect(filename).toBe('onboarding-atendimentos-por-atendente')
    expect(columns.map((c) => c.header)).toEqual([
      '#',
      'Atendente',
      'Equipe',
      'Atendimentos',
      'Horas',
    ])
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ rank: 1, atendente: 'Fulano', equipe: 'Onboarding A' })
    expect(rows[1]).toMatchObject({ rank: 2, atendente: 'Beltrano', equipe: '—' })
  })

  it('export XLSX dispara o util correspondente', () => {
    renderSection()
    fireEvent.click(screen.getByLabelText('Baixar Excel'))
    expect(exportTable.exportToXlsx).toHaveBeenCalledTimes(1)
  })
})

describe('OnboardingTicketSection — 134 · coluna de duração calculável', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('identidade literal: "horas" é a ÚNICA coluna de duração declarada', () => {
    const { columns } = capturarExportCsv()

    // Derivado da declaração real (nunca lista à mão) × conjunto literal escrito à mão.
    // Vermelho se: tirarem `type: 'duration'` de "Horas"; renomearem a chave; ou
    // marcarem como duração uma coluna que não é (ex.: "Atendimentos", que é contagem).
    expect(new Set(chavesDeDuracao(columns))).toEqual(new Set(['horas']))
    expect(columns.find((c) => c.key === 'horas')?.type).toBe('duration')
    expect(columns.find((c) => c.key === 'atendimentos')?.type).toBeUndefined()
  })

  it('o mapper devolve número cru em segundos — nunca texto pré-formatado', () => {
    const { columns, rows } = capturarExportCsv()

    // Literais escritos à mão: 3600 s (a tela mostra "1h") e 1800 s ("30m").
    // Vermelho se o mapper voltar a chamar o `formatSeconds` local ('1h' / '30m').
    expect(rows[0].horas).toBe(3600)
    expect(rows[1].horas).toBe(1800)
    expect(typeof rows[0].horas).toBe('number')

    // Companheira negativa: coluna de TEXTO vizinha continua texto formatado pt-BR.
    expect(rows[0].atendimentos).toBe('10')

    assertCelulasDeDuracaoSaoNumericas(columns, rows)
  })

  it('ausência vira null e o zero legítimo continua 0 (AP-FRONTEND-028)', () => {
    const { columns, rows } = capturarExportCsv(DATA_AUSENCIA)

    // `null` EXPLÍCITO no wire → célula vazia no arquivo, nunca "0h 0m" nem 0.
    // Vermelho se o guard for `=== undefined` (o caso `null` viraria 0) ou se
    // alguém puser `?? 0` no call site.
    expect(rows[0].horas).toBeNull()

    // Companheira positiva, na MESMA execução: 0 é valor, não ausência.
    // Vermelho na sobre-correção `if (!v) return null`.
    expect(rows[1].horas).toBe(0)

    assertCelulasDeDuracaoSaoNumericas(columns, rows)
  })

  it('o XLSX recebe as mesmas colunas tipadas e os mesmos números do CSV', () => {
    renderSection()
    fireEvent.click(screen.getByLabelText('Baixar Excel'))

    const [filename, columns, rows] = vi.mocked(exportTable.exportToXlsx).mock.calls[0]
    expect(filename).toBe('onboarding-atendimentos-por-atendente')
    expect(new Set(chavesDeDuracao(columns))).toEqual(new Set(['horas']))
    expect(rows[0].horas).toBe(3600)
    expect(rows[1].horas).toBe(1800)
  })
})

describe('OnboardingTicketSection — 134 · a TELA não muda', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('a coluna "Horas" da tabela visível continua em "1h" / "30m"', () => {
    renderSection()

    // Literais do `formatSeconds` LOCAL deste arquivo (omite a parte zerada):
    // 3600 → "1h" e 1800 → "30m". Vermelho se alguém "resolver" a demanda mexendo
    // no formatador de tela — inclusive trocando-o pelo `formatSeconds` de
    // `formatters.ts`, que produziria "1h 0m" / "0h 30m".
    expect(celulasDaLinha(0)).toEqual(['1', 'Fulano', 'Onboarding A', '10', '1h'])
    expect(celulasDaLinha(1)).toEqual(['2', 'Beltrano', '—', '4', '30m'])

    // O número cru do export não pode vazar para a tela.
    expect(screen.queryByText('3600')).not.toBeInTheDocument()
    expect(screen.queryByText('01:00:00')).not.toBeInTheDocument()
  })
})
