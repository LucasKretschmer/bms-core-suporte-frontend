/**
 * WCAG 2.1.1 — a volta COMPLETA do drill de gráfico **pelo teclado**, na página real:
 * tabular até o gatilho do gráfico → `Enter` → o modal certo abre → fechar → o foco volta
 * **ao mesmo botão do gráfico**.
 *
 * Por que na página, e não só no componente: quem captura o gatilho é o `openDrill` da
 * página (`useReturnFocus.capture()` lê `document.activeElement`), e quem devolve é o
 * `closeDrill`. O teste de componente (`shared/components/chart-keyboard-drill.test.tsx`)
 * prova a travessia e a identidade do alvo; só o teste de página prova que o caminho de
 * teclado **também** é dono do foco na volta — o requisito que a unidade A11Y-3 entregou
 * para o mouse e que não existia para o teclado, porque o gatilho de teclado não existia.
 *
 * Recorte deliberado: **a seção de categoria é a real** (`SupportCategorySection` +
 * `CategoryChart` reais, com o hook de dados mockado), para que o gatilho seja o botão de
 * verdade e o `DrillSpec` seja o mapeamento de verdade. As outras seções são inertes (não
 * focáveis) — cada uma já tem a sua cobertura de travessia no teste de componente, e
 * mantê-las fora reduz a travessia a paradas reais da página.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import type { UseMetricDrillReturn } from '../shared/hooks/useMetricDrill'
import type { CategoryMetricDto } from '../shared/types/metrics'

// ── Mocks de infraestrutura (mesmo conjunto de index.drill-focus.test.tsx) ────

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
  getByCategory: vi.fn(),
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

// Tokens de cor: jsdom não resolve CSS vars.
vi.mock('../shared/utils/chartTokens', () => ({
  getChartTokens: () => ({ 'chart-1': '#2563EB' }),
  getChartPalette: () => ['#2563EB', '#16A34A'],
  resetChartTokensCache: () => {},
}))

// ── Dados da seção REAL de categoria ─────────────────────────────────────────

const CATEGORIAS: CategoryMetricDto[] = [
  { categoria: 'Dúvida', count: 7, totalSegundos: 3600 },
  { categoria: 'Erro de sistema', count: 3, totalSegundos: 1800 },
]

vi.mock('../shared/hooks/useByCategory', () => ({
  useByCategory: () => ({
    data: { data: CATEGORIAS },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
}))

// ── Seções inertes (sem nenhuma parada de Tab própria) ───────────────────────

vi.mock('./components/SupportKpiSection', () => ({
  SupportKpiSection: () => <div data-testid="kpi-section" />,
}))
vi.mock('./components/SupportMovimentacaoSection', () => ({
  SupportMovimentacaoSection: () => <div data-testid="movimentacao-section" />,
}))
vi.mock('./components/SupportStatusSection', () => ({
  SupportStatusSection: () => <div data-testid="status-section" />,
}))
vi.mock('./components/SupportSlaSection', () => ({
  SupportSlaSection: () => <div data-testid="sla-section" />,
}))
vi.mock('./components/SupportPlanHealthSection', () => ({
  SupportPlanHealthSection: () => <div data-testid="plan-health-section" />,
}))

import DashboardSuportePage from './index'
import { ToastProvider } from '../../../components/ui/Toast'

type Usuario = ReturnType<typeof userEvent.setup>

function descrever(no: Element | null): string {
  if (!no) return '<null>'
  const nome = no.getAttribute('aria-label') ?? no.textContent?.trim().slice(0, 24) ?? ''
  return `${no.tagName.toLowerCase()}[${nome}]`
}

/** Travessia real de `Tab` a partir do foco atual; lança com as paradas se não alcançar. */
async function tabularAte(user: Usuario, alvo: Element, maxPassos = 40): Promise<string[]> {
  const paradas: string[] = []
  for (let i = 0; i < maxPassos; i += 1) {
    await user.tab()
    paradas.push(descrever(document.activeElement))
    if (document.activeElement === alvo) return paradas
  }
  throw new Error(
    `Alvo ${descrever(alvo)} NÃO foi alcançado por Tab em ${maxPassos} passos. ` +
      `Paradas: ${paradas.join(' → ')}`,
  )
}

function renderPagina() {
  return render(
    <ToastProvider>
      {/* Âncora FORA da página: ponto de partida explícito da travessia. */}
      <button type="button" data-testid="ancora">
        âncora
      </button>
      <DashboardSuportePage />
    </ToastProvider>,
  )
}

const NOME_BOTAO = 'Ver chamados da categoria Erro de sistema (3)'

describe('DashboardSuportePage — drill de gráfico pelo teclado (WCAG 2.1.1)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('Tab alcança o gatilho do gráfico de categoria, Enter abre o drill DAQUELA categoria e fechar devolve o foco ao mesmo botão', async () => {
    const user = userEvent.setup()
    renderPagina()

    screen.getByTestId('ancora').focus()
    const botao = screen.getByRole('button', { name: NOME_BOTAO })
    await tabularAte(user, botao)

    await user.keyboard('{Enter}')

    // IDENTIDADE do alvo: o modal é o da categoria do botão alcançado, não "algum" modal.
    expect(await screen.findByText('Apontamentos — Erro de sistema')).toBeInTheDocument()
    expect(screen.queryByText('Apontamentos — Dúvida')).toBeNull()

    // DISCRIMINADOR na mesma execução: o foco entrou no modal e SAIU do gatilho.
    const fechar = screen.getByLabelText('Fechar modal')
    expect(fechar).toHaveFocus()
    expect(botao).not.toHaveFocus()

    await user.keyboard('{Enter}') // "Fechar modal" está focado

    await waitFor(() => expect(screen.queryByText('Apontamentos — Erro de sistema')).toBeNull())
    // O foco voltou ao NÓ capturado antes de abrir — e é o nó que continua na tela
    // (guarda contra asserção sobre nó recriado).
    await waitFor(() => expect(botao).toHaveFocus())
    expect(screen.getByRole('button', { name: NOME_BOTAO })).toBe(botao)
  })

  it('fechar pelo Escape devolve o foco ao gatilho de teclado do gráfico', async () => {
    const user = userEvent.setup()
    renderPagina()

    screen.getByTestId('ancora').focus()
    const botao = screen.getByRole('button', { name: 'Ver chamados da categoria Dúvida (7)' })
    await tabularAte(user, botao)

    await user.keyboard('{Enter}')
    expect(await screen.findByText('Apontamentos — Dúvida')).toBeInTheDocument()
    expect(screen.getByLabelText('Fechar modal')).toHaveFocus()
    expect(botao).not.toHaveFocus()

    await user.keyboard('{Escape}')

    await waitFor(() => expect(screen.queryByText('Apontamentos — Dúvida')).toBeNull())
    await waitFor(() => expect(botao).toHaveFocus())
  })

  it('Shift+Tab a partir do gatilho volta pela ordem do documento (não é armadilha de foco)', async () => {
    const user = userEvent.setup()
    renderPagina()

    screen.getByTestId('ancora').focus()
    const primeiro = screen.getByRole('button', { name: 'Ver chamados da categoria Dúvida (7)' })
    const segundo = screen.getByRole('button', { name: NOME_BOTAO })
    await tabularAte(user, segundo)

    await user.tab({ shift: true })
    expect(primeiro).toHaveFocus()
  })
})
