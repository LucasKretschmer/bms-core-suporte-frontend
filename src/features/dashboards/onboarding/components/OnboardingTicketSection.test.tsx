/**
 * Testes do OnboardingTicketSection (017 Fase D — export "Atendimentos por atendente").
 * Verifica: botões de export aparecem só com dados; export usa o conjunto FILTRADO
 * já em memória (data.porAtendente), mapeado para as colunas visíveis.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

// Evita o import lazy do exceljs.
vi.mock('../../../reports/shared/utils/exportTable', () => ({
  exportToCsv: vi.fn(),
  exportToXlsx: vi.fn(),
}))

import { OnboardingTicketSection } from './OnboardingTicketSection'
import { ToastProvider } from '../../../../components/ui/Toast'
import * as exportTable from '../../../reports/shared/utils/exportTable'
import type { OnboardingTicketStatsDto } from '../../shared/types/metrics'

const DATA: OnboardingTicketStatsDto = {
  emAberto: 3,
  resolvidos: 5,
  porAtendente: [
    { userId: 1, nome: 'Fulano', equipe: 'Onboarding A', nAtendimentos: 10, totalSegundos: 3600 },
    { userId: 2, nome: 'Beltrano', equipe: null, nAtendimentos: 4, totalSegundos: 1800 },
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
