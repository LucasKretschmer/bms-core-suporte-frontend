/**
 * Testes de foco do Dashboard Onboarding — AP-FRONTEND-004 (BUG-001).
 *
 * Verifica que ao sair do Modo Painel, o foco retorna ao botão "Apresentar".
 * Cobre: document.activeElement após handleExitPanel ser chamado.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import React from 'react'
import DashboardOnboardingPage from './index'

// ── Mocks de dependências externas ───────────────────────────────────────────

vi.mock('../../../hooks/usePermissions', () => ({
  usePermissions: () => ({
    isCoordenadorOuAcima: true,
    isAtendente: false,
    isAuthenticated: true,
    role: 'COORDENADOR',
  }),
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

// Mock das seções de onboarding
vi.mock('./components/OnboardingProjectSection', () => ({
  OnboardingProjectSection: () => <div data-testid="project-section" />,
}))

vi.mock('./components/OnboardingTicketSection', () => ({
  OnboardingTicketSection: () => <div data-testid="ticket-section" />,
}))

vi.mock('./components/OnboardingNpsCard', () => ({
  OnboardingNpsCard: () => <div data-testid="nps-card" />,
}))

// Mock do hook de dados de onboarding
vi.mock('./hooks/useOnboardingMetrics', () => ({
  useOnboardingMetrics: () => ({
    data: undefined,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
}))

// Mock do SSE — evita EventSource/QueryClient reais no teste de foco.
vi.mock('../shared/hooks/useMetricsStream', () => ({
  useMetricsStream: () => ({ status: 'closed', pause: vi.fn(), resume: vi.fn() }),
}))

// Mocks dos filtros para evitar Combobox/PeriodFilter reais
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

describe('DashboardOnboardingPage — retorno de foco ao sair do Modo Painel (AP-FRONTEND-004)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('AP-FRONTEND-004: botão Apresentar recebe foco (document.activeElement) após sair do Modo Painel', async () => {
    render(<DashboardOnboardingPage />)

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
