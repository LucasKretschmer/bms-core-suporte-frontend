/**
 * Testes do SupportPlanHealthSection (017 Fase D — export "Saúde dos Planos").
 * Verifica: botões de export aparecem só com dados; export usa o conjunto FILTRADO
 * já em memória (data.data), mapeado para as colunas visíveis (sem categoria HubSpot).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const usePlanHealthMock = vi.fn()
vi.mock('../../shared/hooks/usePlanHealth', () => ({
  usePlanHealth: (params: unknown) => usePlanHealthMock(params),
}))

// Encena o download (evita o import lazy do exceljs), mantendo o RESTO do módulo real —
// inclusive `durationCellFromHours`, o núcleo da conversão da 134. Fake dela provaria o fake.
vi.mock('../../../reports/shared/utils/exportTable', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../reports/shared/utils/exportTable')>()),
  exportToCsv: vi.fn(),
  exportToXlsx: vi.fn(),
}))

import { SupportPlanHealthSection } from './SupportPlanHealthSection'
import { ToastProvider } from '../../../../components/ui/Toast'
import * as exportTable from '../../../reports/shared/utils/exportTable'
import {
  assertCelulasDeDuracaoSaoNumericas,
  chavesDeDuracao,
} from '../../../../test/duracaoExport'
import type { PlanHealthResponseDto } from '../../shared/types/metrics'

// Nomes de campo = os do WIRE do backend (`MetricsDtos.cs:120-132`), ver 123/D4.
// Este arquivo constrói o mock a partir do TIPO do frontend, então NÃO prova o contrato —
// a prova de contrato está em `SupportPlanHealthSection.wire.test.tsx`, com payload literal.
const DATA: PlanHealthResponseDto = {
  summary: { totalClientes: 4, verde: 2, amarelo: 1, vermelho: 1 },
  data: [
    {
      clientId: 1,
      nomeFantasia: 'ACME',
      planNome: 'Premium',
      percentualConsumo: 50,
      horasContratadas: 40,
      horasConsumidas: 20,
      faixa: 'verde',
    },
    {
      clientId: 2,
      nomeFantasia: null,
      planNome: null,
      percentualConsumo: 97,
      horasContratadas: 10,
      horasConsumidas: 9.7,
      faixa: 'vermelho',
    },
  ],
}

function setHookReturn(value: ReturnType<typeof Object>) {
  usePlanHealthMock.mockReturnValue(value)
}

function renderSection() {
  return render(
    <ToastProvider>
      <SupportPlanHealthSection from="2026-06-01" to="2026-06-26" />
    </ToastProvider>,
  )
}

describe('SupportPlanHealthSection — export', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('exibe os botões de export quando há planos', () => {
    setHookReturn({ data: DATA, isLoading: false, isError: false, refetch: vi.fn() })
    renderSection()
    expect(screen.getByLabelText('Baixar CSV')).toBeInTheDocument()
    expect(screen.getByLabelText('Baixar Excel')).toBeInTheDocument()
  })

  it('não exibe botões de export durante o loading', () => {
    setHookReturn({ data: undefined, isLoading: true, isError: false, refetch: vi.fn() })
    renderSection()
    expect(screen.queryByLabelText('Baixar CSV')).not.toBeInTheDocument()
  })

  it('export CSV usa os planos em memória mapeados para as colunas visíveis', () => {
    setHookReturn({ data: DATA, isLoading: false, isError: false, refetch: vi.fn() })
    renderSection()
    fireEvent.click(screen.getByLabelText('Baixar CSV'))

    expect(exportTable.exportToCsv).toHaveBeenCalledTimes(1)
    const [filename, columns, rows] = vi.mocked(exportTable.exportToCsv).mock.calls[0]
    expect(filename).toBe('saude-planos')
    expect(columns.map((c) => c.header)).toEqual([
      'Cliente',
      'Plano',
      'Consumo',
      'Horas do plano',
      'Horas usadas',
      'Saúde',
    ])
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ cliente: 'ACME', plano: 'Premium', saude: 'Ok (< 80%)' })
    expect(rows[1]).toMatchObject({ cliente: '—', plano: '—', saude: 'Crítico (≥ 95%)' })
  })

  it('134 · as duas colunas de horas saem em SEGUNDOS, declaradas como duração', () => {
    setHookReturn({ data: DATA, isLoading: false, isError: false, refetch: vi.fn() })
    renderSection()
    fireEvent.click(screen.getByLabelText('Baixar CSV'))

    const [, columns, rows] = vi.mocked(exportTable.exportToCsv).mock.calls[0]

    // Identidade LITERAL do conjunto derivado (§9.3): vermelho se o `type` sumir de uma
    // das duas, se a chave for renomeada, ou se `consumo` (percentual) for marcado.
    expect(new Set(chavesDeDuracao(columns))).toEqual(new Set(['horasPlano', 'horasUsadas']))
    assertCelulasDeDuracaoSaoNumericas(columns, rows)

    // Origem em HORAS DECIMAIS → linha em SEGUNDOS INTEIROS (§2.1). Literais à mão:
    //   40 h = 144000 · 20 h = 72000 · 10 h = 36000 · 9,7 h = 34920 (9 h 42 min).
    // Trocar `durationCellFromHours` por `durationCell` faria sair 40/20/10/9,7 — 3600×
    // menor, e a planilha diria "40 segundos" onde o plano tem 40 horas.
    expect(rows[0].horasPlano).toBe(144000)
    expect(rows[0].horasUsadas).toBe(72000)
    expect(rows[1].horasPlano).toBe(36000)
    expect(rows[1].horasUsadas).toBe(34920)
  })

  it('nenhuma coluna de export expõe categoria HubSpot', () => {
    setHookReturn({ data: DATA, isLoading: false, isError: false, refetch: vi.fn() })
    renderSection()
    fireEvent.click(screen.getByLabelText('Baixar CSV'))
    const [, columns] = vi.mocked(exportTable.exportToCsv).mock.calls[0]
    const headers = columns.map((c) => c.header.toLowerCase())
    expect(headers.some((h) => h.includes('categoria'))).toBe(false)
  })
})
