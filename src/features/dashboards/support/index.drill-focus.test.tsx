/**
 * Dashboard Suporte — §5.3: o modal de drill prende o foco **e** devolve o foco ao
 * gatilho ao fechar. A devolução é de quem ABRE (ver `components/ui/Modal.tsx`, bloco
 * "O QUE ELE NÃO FAZ"), por isso o teste é da PÁGINA, não do modal.
 *
 * Cobre os **5 pontos de abertura** da página (um `it` por ponto), porque o gatilho é
 * capturado no `openDrill` e um ponto que voltasse a passar `setActiveDrill` cru ficaria
 * sem devolução — e sem teste vermelho, se a cobertura fosse de um ponto só.
 *
 * Os stubs das seções reproduzem o TIPO DE NÓ do gatilho real, que é o que decide se a
 * captura por `document.activeElement` funciona:
 *  - KPI  → `<div role="button" tabindex="0">` (é o `KpiCard`), clicado no filho;
 *  - Status → nó SVG com `tabindex="-1"` (é o que o Recharts 3 produz — medido: clicar
 *    numa barra deixa o foco em `<g class="recharts-zIndex-layer_…" tabindex="-1">`);
 *  - Categoria/SLA/Faixa → `<button>`.
 *
 * Padrões anti-"passa nos dois mundos":
 *  - identidade do nó (`expect(gatilho).toHaveFocus()` sobre o nó capturado ANTES de
 *    abrir), nunca "não é o body";
 *  - discriminador na mesma execução: com o modal aberto, o foco está no "Fechar modal"
 *    e **não** no gatilho.
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

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>()
  return {
    ...actual,
    useQuery: vi.fn().mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    }),
    useQueryClient: vi.fn().mockReturnValue({ invalidateQueries: vi.fn() }),
  }
})

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
}))

vi.mock('../../reports/shared/services/reportsService', () => ({
  listTeams: vi.fn().mockResolvedValue([]),
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

// Drill vazio: o modal cai no EmptyState — basta, o que se testa aqui é o foco.
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

vi.mock('../shared/hooks/useMetricsOverview', () => ({
  useMetricsOverview: () => ({
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

// ── Stubs das seções: cada uma expõe o gatilho no TIPO DE NÓ do componente real ──

type DrillProp = { onDrillSpec?: (spec: DrillSpec) => void }

vi.mock('./components/SupportKpiSection', () => ({
  SupportKpiSection: ({ onDrillSpec }: DrillProp) => (
    // Espelha o KpiCard: <div role="button" tabIndex={0}> com o texto num filho.
    <div
      role="button"
      tabIndex={0}
      data-testid="gatilho-kpi"
      onClick={() =>
        onDrillSpec?.({ metric: 'tickets-backlog', title: 'KPI — Backlog' })
      }
    >
      <span data-testid="gatilho-kpi-filho">42</span>
    </div>
  ),
}))

vi.mock('./components/SupportMovimentacaoSection', () => ({
  SupportMovimentacaoSection: () => <div data-testid="movimentacao-section" />,
}))

vi.mock('./components/SupportStatusSection', () => ({
  SupportStatusSection: ({
    onStatusDrill,
  }: {
    onStatusDrill?: (spec: DrillSpec) => void
  }) => (
    // Espelha o Recharts 3: o nó clicável é SVG e focável por tabindex="-1".
    <svg data-testid="grafico-status">
      <g
        data-testid="gatilho-status"
        tabIndex={-1}
        onClick={() =>
          onStatusDrill?.({
            metric: 'tickets-backlog',
            title: 'Status — Em atendimento',
            params: { statusKey: 'em-atendimento' },
          })
        }
      >
        <rect width="10" height="10" />
      </g>
    </svg>
  ),
}))

vi.mock('./components/SupportCategorySection', () => ({
  SupportCategorySection: ({
    onCategoryDrill,
  }: {
    onCategoryDrill?: (spec: DrillSpec) => void
  }) => (
    <button
      type="button"
      data-testid="gatilho-categoria"
      onClick={() =>
        onCategoryDrill?.({
          metric: 'apontamentos',
          title: 'Apontamentos — Dúvida',
          params: { categoria: 'Dúvida' },
        })
      }
    >
      categoria
    </button>
  ),
}))

vi.mock('./components/SupportSlaSection', () => ({
  SupportSlaSection: ({
    onSegmentDrill,
  }: {
    onSegmentDrill?: (spec: DrillSpec) => void
  }) => (
    <button
      type="button"
      data-testid="gatilho-sla"
      onClick={() =>
        onSegmentDrill?.({
          metric: 'tickets-sla',
          title: 'SLA — No prazo',
          params: { sla: 'on' },
        })
      }
    >
      sla
    </button>
  ),
}))

vi.mock('./components/SupportPlanHealthSection', () => ({
  SupportPlanHealthSection: ({
    onFaixaDrill,
  }: {
    onFaixaDrill?: (spec: DrillSpec) => void
  }) => (
    <button
      type="button"
      data-testid="gatilho-faixa"
      onClick={() =>
        onFaixaDrill?.({
          metric: 'plan-health-clientes',
          title: 'Saúde dos Planos — Vermelho',
          params: { faixa: 'vermelho' },
        })
      }
    >
      faixa
    </button>
  ),
}))

import DashboardSuportePage from './index'
import { ToastProvider } from '../../../components/ui/Toast'

function renderPagina() {
  return render(
    <ToastProvider>
      <DashboardSuportePage />
    </ToastProvider>,
  )
}

/**
 * Roteiro único dos 5 pontos: clicar no gatilho, provar que o foco ENTROU no modal
 * (e saiu do gatilho), fechar pelo "X" e exigir o foco de volta NO MESMO NÓ.
 */
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

  // O modal da família certa abriu (prova que este ponto de abertura foi exercitado).
  expect(await screen.findByText(opts.tituloEsperado)).toBeInTheDocument()

  // DISCRIMINADOR (mesma execução): o foco está DENTRO do modal e NÃO no gatilho.
  const fechar = screen.getByLabelText('Fechar modal')
  expect(fechar).toHaveFocus()
  expect(gatilho).not.toHaveFocus()

  await user.click(fechar)

  await waitFor(() => expect(screen.queryByText(opts.tituloEsperado)).toBeNull())
  // IDENTIDADE: o foco voltou ao nó capturado antes de abrir — e esse nó é o que
  // continua na tela (guarda contra assert sobre nó recriado/destacado).
  await waitFor(() => expect(gatilho).toHaveFocus())
  expect(screen.getByTestId(opts.testIdGatilho)).toBe(gatilho)
}

describe('DashboardSuportePage — devolução do foco ao gatilho do drill (§5.3)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('ponto 1/5 — KPI (div role=button): fechar devolve o foco ao card', async () => {
    await abrirEFechar({
      testIdGatilho: 'gatilho-kpi',
      testIdAlvoDoClique: 'gatilho-kpi-filho',
      tituloEsperado: 'KPI — Backlog',
    })
  })

  it('ponto 2/5 — barra de status (nó SVG focável): fechar devolve o foco à barra', async () => {
    await abrirEFechar({
      testIdGatilho: 'gatilho-status',
      tituloEsperado: 'Status — Em atendimento',
    })
  })

  it('ponto 3/5 — categoria (família apontamento): fechar devolve o foco à barra', async () => {
    await abrirEFechar({
      testIdGatilho: 'gatilho-categoria',
      tituloEsperado: 'Apontamentos — Dúvida',
    })
  })

  it('ponto 4/5 — fatia de SLA: fechar devolve o foco à fatia', async () => {
    await abrirEFechar({
      testIdGatilho: 'gatilho-sla',
      tituloEsperado: 'SLA — No prazo',
    })
  })

  it('ponto 5/5 — faixa de saúde (família cliente): fechar devolve o foco à faixa', async () => {
    await abrirEFechar({
      testIdGatilho: 'gatilho-faixa',
      tituloEsperado: 'Saúde dos Planos — Vermelho',
    })
  })

  it('fechar pelo Escape também devolve o foco ao gatilho', async () => {
    const user = userEvent.setup()
    renderPagina()

    const gatilho = screen.getByTestId('gatilho-categoria')
    await user.click(gatilho)
    expect(await screen.findByText('Apontamentos — Dúvida')).toBeInTheDocument()
    expect(screen.getByLabelText('Fechar modal')).toHaveFocus()
    expect(gatilho).not.toHaveFocus()

    await user.keyboard('{Escape}')

    await waitFor(() => expect(screen.queryByText('Apontamentos — Dúvida')).toBeNull())
    await waitFor(() => expect(gatilho).toHaveFocus())
  })

  it('fechar pelo overlay também devolve o foco ao gatilho', async () => {
    const user = userEvent.setup()
    renderPagina()

    const gatilho = screen.getByTestId('gatilho-sla')
    await user.click(gatilho)
    expect(await screen.findByText('SLA — No prazo')).toBeInTheDocument()

    const dialog = screen.getByRole('dialog')
    const overlay = dialog.querySelector('[aria-hidden="true"]')
    expect(overlay).not.toBeNull()
    await user.click(overlay as Element)

    await waitFor(() => expect(screen.queryByText('SLA — No prazo')).toBeNull())
    await waitFor(() => expect(gatilho).toHaveFocus())
  })
})
