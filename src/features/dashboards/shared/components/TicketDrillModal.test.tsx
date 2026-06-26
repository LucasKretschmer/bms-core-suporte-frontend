/**
 * Testes do TicketDrillModal (016).
 * Verifica: linha clicável navega para ticket-detail pelo id INTERNO com from=dashboard;
 * pausa o SSE ao montar e retoma ao desmontar (live não "puxa o tapete");
 * export usa fetchAllPaginated com os MESMOS filtros/metric da tela (conjunto completo).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'

const navigateSpy = vi.fn()
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigateSpy,
}))

vi.mock('../services/metricsService', () => ({
  getMetricRows: vi.fn(),
}))

import { TicketDrillModal } from './TicketDrillModal'
import { ToastProvider } from '../../../../components/ui/Toast'
import * as metricsService from '../services/metricsService'
import type { PaginatedResponse } from '../../../../types/api'
import type {
  DrillSpec,
  MetricsBaseParams,
  TicketRowDto,
} from '../types/metrics'
import type { useTicketDrill } from '../hooks/useTicketDrill'

const ROW: TicketRowDto = {
  ticketId: 77,
  hubspotTicketId: '12345',
  assunto: 'Falha no login',
  clienteNome: 'ACME',
  equipe: 'Suporte N1',
  ownerNome: 'Fulano',
  status: 'Em andamento',
  hsCriadoEm: '2026-06-10',
  fechadoEm: null,
  reabertoEm: '2026-06-20',
  frHoras: null,
  frHorasUteis: null,
  frSla: null,
  resHoras: null,
  resHorasUteis: null,
  csat: null,
  isOneTouch: null,
  hubspotUrl: null,
}

const PAGE: PaginatedResponse<TicketRowDto> = {
  items: [ROW],
  totalCount: 1,
  page: 1,
  pageSize: 25,
  totalPages: 1,
}

const SPEC: DrillSpec = { metric: 'tickets-reabertos', title: 'Tickets reabertos' }
const BASE: MetricsBaseParams = {
  scope: 'management:suporte',
  from: '2026-06-01',
  to: '2026-06-26',
  clientId: '42',
}

function makeDrill(
  overrides: Partial<ReturnType<typeof useTicketDrill>> = {},
): ReturnType<typeof useTicketDrill> {
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
    isActive: true,
    ...overrides,
  }
}

function renderModal(props: Partial<React.ComponentProps<typeof TicketDrillModal>> = {}) {
  const onStreamPause = vi.fn()
  const onStreamResume = vi.fn()
  const onClose = vi.fn()
  const utils = render(
    <ToastProvider>
      <TicketDrillModal
        activeDrill={SPEC}
        onClose={onClose}
        drill={makeDrill()}
        baseParams={BASE}
        onStreamPause={onStreamPause}
        onStreamResume={onStreamResume}
        {...props}
      />
    </ToastProvider>,
  )
  return { ...utils, onStreamPause, onStreamResume, onClose }
}

describe('TicketDrillModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('exibe o título do DrillSpec', () => {
    renderModal()
    expect(screen.getByText('Tickets reabertos')).toBeInTheDocument()
  })

  it('linha clicável navega para ticket-detail pelo id INTERNO com from=dashboard', () => {
    renderModal()
    // A célula exibe o id HubSpot (#12345), mas a navegação usa o id interno (77).
    fireEvent.click(screen.getByText('#12345'))
    expect(navigateSpy).toHaveBeenCalledWith({
      to: '/relatorios/tickets/$ticketId',
      params: { ticketId: '77' },
      search: { from: 'dashboard' },
    })
  })

  it('pausa o SSE ao montar e retoma ao desmontar (live não puxa o tapete)', () => {
    const { onStreamPause, onStreamResume, unmount } = renderModal()
    expect(onStreamPause).toHaveBeenCalledTimes(1)
    expect(onStreamResume).not.toHaveBeenCalled()
    unmount()
    expect(onStreamResume).toHaveBeenCalledTimes(1)
  })

  it('exporta o conjunto FILTRADO COMPLETO via getMetricRows (mesmos filtros/metric da tela)', async () => {
    vi.mocked(metricsService.getMetricRows).mockResolvedValue(PAGE)
    renderModal()

    fireEvent.click(screen.getByLabelText('Baixar CSV'))

    await waitFor(() => expect(metricsService.getMetricRows).toHaveBeenCalled())
    expect(metricsService.getMetricRows).toHaveBeenCalledWith(
      expect.objectContaining({
        metric: 'tickets-reabertos',
        scope: 'management:suporte',
        from: '2026-06-01',
        to: '2026-06-26',
        clientId: '42',
      }),
    )
  })

  it('estado vazio quando não há linhas', () => {
    render(
      <ToastProvider>
        <TicketDrillModal
          activeDrill={SPEC}
          onClose={vi.fn()}
          drill={makeDrill({
            data: { items: [], totalCount: 0, page: 1, pageSize: 25, totalPages: 0 },
          })}
          baseParams={BASE}
        />
      </ToastProvider>,
    )
    expect(screen.getByText(/Nenhum registro encontrado/i)).toBeInTheDocument()
  })

  it('estado de erro com botão de tentar novamente', () => {
    const refetch = vi.fn()
    render(
      <ToastProvider>
        <TicketDrillModal
          activeDrill={SPEC}
          onClose={vi.fn()}
          drill={makeDrill({ isError: true, data: undefined, refetch })}
          baseParams={BASE}
        />
      </ToastProvider>,
    )
    const retry = screen.getByRole('button', { name: /tentar novamente/i })
    fireEvent.click(retry)
    expect(refetch).toHaveBeenCalled()
  })
})
