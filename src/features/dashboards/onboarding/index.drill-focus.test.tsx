/**
 * Dashboard Onboarding — §5.3: o modal de drill prende o foco **e** devolve o foco ao
 * gatilho ao fechar. A devolução é de quem ABRE (ver `components/ui/Modal.tsx`), por
 * isso o teste é da PÁGINA.
 *
 * Cobre os **3 pontos de abertura** desta página, um `it` por ponto. Os stubs das seções
 * reproduzem o TIPO DE NÓ do gatilho real:
 *  - projeto → fatia de donut = nó SVG com `tabindex="-1"` (o que o Recharts 3 produz);
 *  - ticket  → `KpiCard` = `<div role="button" tabindex="0">`, clicado no filho;
 *  - atendente → `AgentRow` = `<tr role="button" tabindex="0">`, clicado na célula.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import type { DrillSpec } from '../shared/types/metrics'
import type { UseMetricDrillReturn } from '../shared/hooks/useMetricDrill'

// ── Mocks de infraestrutura ──────────────────────────────────────────────────

vi.mock('../../../hooks/usePermissions', () => ({
  usePermissions: () => ({
    isCoordenadorOuAcima: true,
    isAtendente: false,
    isAuthenticated: true,
    primaryTeamId: null,
    role: 'COORDENADOR',
  }),
}))

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
}))

vi.mock('../shared/services/metricsService', () => ({
  getMetricRows: vi.fn().mockResolvedValue({
    items: [],
    totalCount: 0,
    page: 1,
    pageSize: 25,
    totalPages: 0,
  }),
}))

const drillVazio: UseMetricDrillReturn<never> = {
  data: { items: [], totalCount: 0, page: 1, pageSize: 25, totalPages: 0 },
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
}

vi.mock('../shared/hooks/useMetricDrill', () => ({
  useMetricDrill: () => drillVazio,
}))

vi.mock('./hooks/useOnboardingMetrics', () => ({
  useOnboardingMetrics: () => ({
    data: null,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
}))

vi.mock('../shared/hooks/useMetricsStream', () => ({
  useMetricsStream: () => ({ status: 'closed', pause: vi.fn(), resume: vi.fn() }),
}))

vi.mock('../shared/components/DashboardFilters', () => ({
  DashboardFilters: () => <div data-testid="filtros" />,
}))

vi.mock('../panel/PanelMode', () => ({
  PanelMode: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

// ── Stubs das seções ─────────────────────────────────────────────────────────

vi.mock('./components/OnboardingNpsCard', () => ({
  OnboardingNpsCard: () => <div data-testid="nps" />,
}))

vi.mock('./components/OnboardingProjectSection', () => ({
  OnboardingProjectSection: ({
    onProjectDrill,
  }: {
    onProjectDrill?: (spec: DrillSpec) => void
  }) => (
    // Espelha a fatia de donut do Recharts: nó SVG focável por tabindex="-1".
    <svg data-testid="donut-projetos">
      <g
        data-testid="gatilho-projeto"
        tabIndex={-1}
        onClick={() =>
          onProjectDrill?.({
            metric: 'projetos',
            title: 'Projetos em execução',
            params: { stage: 'execucao' },
          })
        }
      >
        <rect width="10" height="10" />
      </g>
    </svg>
  ),
}))

vi.mock('./components/OnboardingTicketSection', () => ({
  OnboardingTicketSection: ({
    onTicketDrill,
    onAgentDrill,
  }: {
    onTicketDrill?: (spec: DrillSpec) => void
    onAgentDrill?: (spec: DrillSpec) => void
  }) => (
    <div>
      {/* Espelha o KpiCard */}
      <div
        role="button"
        tabIndex={0}
        data-testid="gatilho-ticket"
        onClick={() =>
          onTicketDrill?.({ metric: 'tickets-abertos', title: 'Tickets abertos' })
        }
      >
        <span data-testid="gatilho-ticket-filho">7</span>
      </div>

      {/* Espelha o AgentRow: <tr role="button" tabIndex={0}> */}
      <table>
        <tbody>
          <tr
            role="button"
            tabIndex={0}
            data-testid="gatilho-atendente"
            onClick={() =>
              onAgentDrill?.({
                metric: 'apontamentos',
                title: 'Apontamentos — Fulano',
                params: { userId: '9' },
              })
            }
          >
            <td data-testid="gatilho-atendente-celula">Fulano</td>
          </tr>
        </tbody>
      </table>
    </div>
  ),
}))

import DashboardOnboardingPage from './index'
import { ToastProvider } from '../../../components/ui/Toast'

function renderPagina() {
  return render(
    <ToastProvider>
      <DashboardOnboardingPage />
    </ToastProvider>,
  )
}

async function abrirEFechar(opts: {
  testIdGatilho: string
  testIdAlvoDoClique?: string
  tituloEsperado: string
}) {
  const user = userEvent.setup()
  renderPagina()

  const gatilho = screen.getByTestId(opts.testIdGatilho)
  const alvo = opts.testIdAlvoDoClique
    ? screen.getByTestId(opts.testIdAlvoDoClique)
    : gatilho

  await user.click(alvo)

  expect(await screen.findByText(opts.tituloEsperado)).toBeInTheDocument()

  // DISCRIMINADOR (mesma execução): foco DENTRO do modal, NÃO no gatilho.
  const fechar = screen.getByLabelText('Fechar modal')
  expect(fechar).toHaveFocus()
  expect(gatilho).not.toHaveFocus()

  await user.click(fechar)

  await waitFor(() => expect(screen.queryByText(opts.tituloEsperado)).toBeNull())
  await waitFor(() => expect(gatilho).toHaveFocus())
  expect(screen.getByTestId(opts.testIdGatilho)).toBe(gatilho)
}

describe('DashboardOnboardingPage — devolução do foco ao gatilho do drill (§5.3)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('ponto 1/3 — fatia de donut de projetos (nó SVG focável)', async () => {
    await abrirEFechar({
      testIdGatilho: 'gatilho-projeto',
      tituloEsperado: 'Projetos em execução',
    })
  })

  it('ponto 2/3 — KPI de ticket (div role=button)', async () => {
    await abrirEFechar({
      testIdGatilho: 'gatilho-ticket',
      testIdAlvoDoClique: 'gatilho-ticket-filho',
      tituloEsperado: 'Tickets abertos',
    })
  })

  it('ponto 3/3 — linha de atendente (tr role=button)', async () => {
    await abrirEFechar({
      testIdGatilho: 'gatilho-atendente',
      testIdAlvoDoClique: 'gatilho-atendente-celula',
      tituloEsperado: 'Apontamentos — Fulano',
    })
  })

  it('fechar pelo Escape também devolve o foco ao gatilho', async () => {
    const user = userEvent.setup()
    renderPagina()

    const gatilho = screen.getByTestId('gatilho-ticket')
    await user.click(screen.getByTestId('gatilho-ticket-filho'))
    expect(await screen.findByText('Tickets abertos')).toBeInTheDocument()
    expect(screen.getByLabelText('Fechar modal')).toHaveFocus()
    expect(gatilho).not.toHaveFocus()

    await user.keyboard('{Escape}')

    await waitFor(() => expect(screen.queryByText('Tickets abertos')).toBeNull())
    await waitFor(() => expect(gatilho).toHaveFocus())
  })
})
