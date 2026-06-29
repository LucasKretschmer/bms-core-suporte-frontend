/**
 * Testes do DrillDownModal (017 Fase C — correção do export "só a página visível").
 * Verifica: export usa getDrillDownRows via fetchAllPaginated com os MESMOS filtros/scope
 * da tela (conjunto FILTRADO COMPLETO), não apenas os itens já carregados na página.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'

vi.mock('../services/metricsService', () => ({
  getDrillDownRows: vi.fn(),
}))

// Evita o import lazy do exceljs no teste do XLSX.
vi.mock('../../../reports/shared/utils/exportTable', () => ({
  exportToCsv: vi.fn(),
  exportToXlsx: vi.fn(),
}))

import { DrillDownModal } from './DrillDownModal'
import { ToastProvider } from '../../../../components/ui/Toast'
import * as metricsService from '../services/metricsService'
import * as exportTable from '../../../reports/shared/utils/exportTable'
import type { PaginatedResponse } from '../../../../types/api'
import type { MetricsBaseParams, TimeEntryRowDto } from '../types/metrics'
import type { useDrillDownRows } from '../hooks/useDrillDownRows'

const ROW: TimeEntryRowDto = {
  atendente: 'Fulano',
  equipe: 'Suporte N1',
  hubspotTicketId: '12345',
  assunto: 'Falha no login',
  dataApontamento: '2026-06-10',
  totalSegundos: 3600,
} as TimeEntryRowDto

const PAGE: PaginatedResponse<TimeEntryRowDto> = {
  items: [ROW],
  totalCount: 1,
  page: 1,
  pageSize: 25,
  totalPages: 1,
}

const BASE: MetricsBaseParams = {
  scope: 'management:suporte',
  from: '2026-06-01',
  to: '2026-06-26',
  clientId: '42',
  supportPlanId: '7',
}

function makeDrillDown(
  overrides: Partial<ReturnType<typeof useDrillDownRows>> = {},
): ReturnType<typeof useDrillDownRows> {
  return {
    data: PAGE,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
    page: 1,
    pageSize: 25,
    sortBy: null,
    sortDirection: 'desc',
    setPage: vi.fn(),
    setPageSize: vi.fn(),
    setSort: vi.fn(),
    enable: vi.fn(),
    disable: vi.fn(),
    isEnabled: true,
    ...overrides,
  }
}

function renderModal(props: Partial<React.ComponentProps<typeof DrillDownModal>> = {}) {
  return render(
    <ToastProvider>
      <DrillDownModal
        isOpen
        onClose={vi.fn()}
        title="Detalhes de apontamentos"
        drillDown={makeDrillDown()}
        baseParams={BASE}
        {...props}
      />
    </ToastProvider>,
  )
}

describe('DrillDownModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('exibe o título do modal', () => {
    renderModal()
    expect(screen.getByText('Detalhes de apontamentos')).toBeInTheDocument()
  })

  it('exporta o conjunto FILTRADO COMPLETO via getDrillDownRows (mesmos filtros/scope da tela)', async () => {
    vi.mocked(metricsService.getDrillDownRows).mockResolvedValue(PAGE)
    renderModal()

    fireEvent.click(screen.getByLabelText('Baixar CSV'))

    await waitFor(() => expect(metricsService.getDrillDownRows).toHaveBeenCalled())
    expect(metricsService.getDrillDownRows).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: 'management:suporte',
        from: '2026-06-01',
        to: '2026-06-26',
        clientId: '42',
        supportPlanId: '7',
        format: 'rows',
      }),
    )
    // Não exporta direto os items visíveis sem antes buscar todas as páginas.
    await waitFor(() => expect(exportTable.exportToCsv).toHaveBeenCalled())
  })

  it('export XLSX também busca o conjunto completo', async () => {
    vi.mocked(metricsService.getDrillDownRows).mockResolvedValue(PAGE)
    renderModal()

    fireEvent.click(screen.getByLabelText('Baixar Excel'))

    await waitFor(() => expect(metricsService.getDrillDownRows).toHaveBeenCalled())
    await waitFor(() => expect(exportTable.exportToXlsx).toHaveBeenCalled())
  })

  it('estado vazio quando não há linhas (sem botões de export)', () => {
    renderModal({
      drillDown: makeDrillDown({
        data: { items: [], totalCount: 0, page: 1, pageSize: 25, totalPages: 0 },
      }),
    })
    expect(screen.getByText(/Nenhum apontamento encontrado/i)).toBeInTheDocument()
    expect(screen.queryByLabelText('Baixar CSV')).not.toBeInTheDocument()
  })
})
