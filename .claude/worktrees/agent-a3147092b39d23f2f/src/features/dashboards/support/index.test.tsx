/**
 * Testes de foco do Dashboard Suporte — AP-FRONTEND-004 (BUG-001).
 *
 * Verifica que ao sair do Modo Painel, o foco retorna ao botão "Apresentar".
 * Cobre: document.activeElement após handleExitPanel ser chamado.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import React from 'react'
import DashboardSuportePage from './index'

// ── Mocks de dependências externas ───────────────────────────────────────────

vi.mock('../../../hooks/usePermissions', () => ({
  usePermissions: () => ({
    isCoordenadorOuAcima: true,
    isAtendente: false,
    isAuthenticated: true,
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
    useQueryClient: vi.fn().mockReturnValue({
      invalidateQueries: vi.fn(),
    }),
  }
})

// Mock das seções para não precisar dos dados reais
vi.mock('./components/SupportKpiSection', () => ({
  SupportKpiSection: () => <div data-testid="kpi-section" />,
}))

vi.mock('./components/SupportMovimentacaoSection', () => ({
  SupportMovimentacaoSection: () => <div data-testid="movimentacao-section" />,
}))

vi.mock('./components/SupportStatusSection', () => ({
  SupportStatusSection: () => <div data-testid="status-section" />,
}))

vi.mock('./components/SupportCategorySection', () => ({
  SupportCategorySection: () => <div data-testid="category-section" />,
}))

vi.mock('./components/SupportSlaSection', () => ({
  SupportSlaSection: () => <div data-testid="sla-section" />,
}))

vi.mock('./components/SupportPlanHealthSection', () => ({
  SupportPlanHealthSection: () => <div data-testid="plan-section" />,
}))

vi.mock('../shared/components/DrillDownModal', () => ({
  DrillDownModal: () => null,
}))

// Mock do PanelMode — ao clicar no botão de saída, chama onExit
vi.mock('../panel/PanelMode', () => ({
  PanelMode: ({ onExit, children }: { isActive: boolean; onExit: () => void; children: React.ReactNode }) => (
    <div data-testid="panel-mode" role="dialog" aria-modal="true" aria-label="Modo Painel">
      {children}
      <button
        aria-label="Sair do Modo Painel (Esc)"
        onClick={onExit}
      >
        Sair
      </button>
    </div>
  ),
}))

// Mock dos hooks de dados dos dashboards
vi.mock('../shared/hooks/useMetricsOverview', () => ({
  useMetricsOverview: () => ({ data: null, isLoading: false, isError: false, refetch: vi.fn() }),
}))

vi.mock('../shared/hooks/useDrillDownRows', () => ({
  useDrillDownRows: () => ({
    data: null,
    isLoading: false,
    isError: false,
    setPage: vi.fn(),
    setPageSize: vi.fn(),
    setSortBy: vi.fn(),
    setSortDirection: vi.fn(),
    enable: vi.fn(),
    page: 1,
    pageSize: 25,
  }),
}))

vi.mock('../shared/hooks/useMetricsStream', () => ({
  useMetricsStream: () => ({ status: 'closed', pause: vi.fn(), resume: vi.fn() }),
}))

vi.mock('../../reports/shared/services/reportsService', () => ({
  listTeams: vi.fn().mockResolvedValue([]),
}))

// Mocks dos filtros para evitar Combobox/PeriodFilter reais
vi.mock('../shared/components/DashboardFilters', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../shared/components/DashboardFilters')>()
  return actual // usa o componente real — é o que estamos testando
})

vi.mock('../../../features/reports/shared/components/PeriodFilter', () => ({
  PeriodFilter: () => <div data-testid="period-filter" />,
}))

vi.mock('../../../features/reports/shared/components/ClientCombobox', () => ({
  ClientCombobox: () => <div data-testid="client-combobox" />,
}))

vi.mock('../../../features/reports/shared/components/PlanCombobox', () => ({
  PlanCombobox: () => <div data-testid="plan-combobox" />,
}))

vi.mock('../../../components/ui/Combobox', () => ({
  Combobox: () => <div data-testid="combobox" />,
}))

// ── Testes ────────────────────────────────────────────────────────────────────

describe('DashboardSuportePage — retorno de foco ao sair do Modo Painel (AP-FRONTEND-004)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('AP-FRONTEND-004: botão Apresentar recebe foco (document.activeElement) após sair do Modo Painel', async () => {
    render(<DashboardSuportePage />)

    // 1. Abre o Modo Painel clicando em "Apresentar"
    const apresentarButton = screen.getByText('Apresentar')
    fireEvent.click(apresentarButton)

    // 2. Painel está ativo — botão de saída presente
    const exitButton = screen.getByLabelText('Sair do Modo Painel (Esc)')
    expect(exitButton).toBeInTheDocument()

    // 3. Sai do painel
    fireEvent.click(exitButton)

    // 4. handleExitPanel usa setTimeout(0) — avança o timer
    await act(async () => {
      vi.runAllTimers()
    })

    // 5. Verifica que o foco voltou ao botão Apresentar
    const apresentarButtonAfterExit = screen.getByText('Apresentar')
    expect(document.activeElement).toBe(apresentarButtonAfterExit.closest('button'))
  })
})
