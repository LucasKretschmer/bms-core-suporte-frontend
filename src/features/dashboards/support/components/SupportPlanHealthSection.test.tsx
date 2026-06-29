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

// Evita o import lazy do exceljs.
vi.mock('../../../reports/shared/utils/exportTable', () => ({
  exportToCsv: vi.fn(),
  exportToXlsx: vi.fn(),
}))

import { SupportPlanHealthSection } from './SupportPlanHealthSection'
import { ToastProvider } from '../../../../components/ui/Toast'
import * as exportTable from '../../../reports/shared/utils/exportTable'
import type { PlanHealthResponseDto } from '../../shared/types/metrics'

const DATA: PlanHealthResponseDto = {
  summary: { totalVerde: 2, totalAmarelo: 1, totalVermelho: 1 },
  data: [
    {
      clientId: 1,
      nomeCliente: 'ACME',
      nomePlano: 'Premium',
      percentualConsumo: 50,
      horasPlano: 40,
      horasUsadas: 20,
      faixaSaude: 'verde',
    },
    {
      clientId: 2,
      nomeCliente: null,
      nomePlano: null,
      percentualConsumo: 97,
      horasPlano: 10,
      horasUsadas: 9.7,
      faixaSaude: 'vermelho',
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

  it('nenhuma coluna de export expõe categoria HubSpot', () => {
    setHookReturn({ data: DATA, isLoading: false, isError: false, refetch: vi.fn() })
    renderSection()
    fireEvent.click(screen.getByLabelText('Baixar CSV'))
    const [, columns] = vi.mocked(exportTable.exportToCsv).mock.calls[0]
    const headers = columns.map((c) => c.header.toLowerCase())
    expect(headers.some((h) => h.includes('categoria'))).toBe(false)
  })
})
