/**
 * Testes de RBAC do Dashboard Suporte (118.6 / U7).
 *
 * Arquivo separado de index.test.tsx (que usa mock estático de usePermissions) — aqui
 * usePermissions é mockável por teste (vi.mock('../../../hooks/usePermissions') +
 * vi.mocked(usePermissions).mockReturnValue(...)), seguindo o padrão de
 * index.teams.test.tsx.
 *
 * Cobre:
 * - ATENDENTE não vê guard de "Acesso restrito" (guard removido — 118.6).
 * - ATENDENTE não vê a seção "Saúde dos Planos" (sempre global — vazaria dados
 *   de todas as equipes ao atendente, A01).
 * - GERENTE continua vendo "Saúde dos Planos" (regressão).
 * - Scope inicial: ATENDENTE com equipe primária → 'team:{id}'; ATENDENTE sem equipe
 *   primária → fail-closed ('team:0', nunca 'management:suporte').
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import DashboardSuportePage from './index'
import { usePermissions } from '../../../hooks/usePermissions'
import { useMetricsOverview } from '../shared/hooks/useMetricsOverview'

vi.mock('../../../hooks/usePermissions')

// Seções pesadas — fora do escopo destes testes de RBAC.
vi.mock('./components/SupportKpiSection', () => ({ SupportKpiSection: () => null }))
vi.mock('./components/SupportMovimentacaoSection', () => ({ SupportMovimentacaoSection: () => null }))
vi.mock('./components/SupportStatusSection', () => ({ SupportStatusSection: () => null }))
vi.mock('./components/SupportCategorySection', () => ({ SupportCategorySection: () => null }))
vi.mock('./components/SupportSlaSection', () => ({ SupportSlaSection: () => null }))
vi.mock('./components/SupportPlanHealthSection', () => ({
  SupportPlanHealthSection: () => <div data-testid="plan-section" />,
}))
vi.mock('../panel/PanelMode', () => ({ PanelMode: () => null }))

vi.mock('../shared/hooks/useMetricsOverview', () => ({
  useMetricsOverview: vi.fn(() => ({
    data: undefined,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  })),
}))
vi.mock('../shared/hooks/useMetricsStream', () => ({
  useMetricsStream: () => ({ status: 'idle', pause: vi.fn(), resume: vi.fn() }),
}))
vi.mock('../../reports/shared/services/reportsService', () => ({
  listTeams: vi.fn().mockResolvedValue([]),
}))

// DashboardFilters mockado para capturar o `selectedScope` recebido (118.6 — spec U7).
vi.mock('../shared/components/DashboardFilters', () => ({
  DashboardFilters: ({ selectedScope }: { selectedScope?: string }) => (
    <div data-testid="dashboard-filters" data-scope={selectedScope ?? ''} />
  ),
}))

const mockedPermissions = vi.mocked(usePermissions)
const mockedUseMetricsOverview = vi.mocked(useMetricsOverview)

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    React.createElement(QueryClientProvider, { client }, React.createElement(DashboardSuportePage)),
  )
}

describe('DashboardSuportePage — RBAC (118.6)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('ATENDENTE: não renderiza ErrorState/"Acesso restrito" (guard removido)', () => {
    mockedPermissions.mockReturnValue({
      role: 'ATENDENTE',
      isCoordenadorOuAcima: false,
      isGerentePlus: false,
      isAtendente: true,
      isGestor: false,
      primaryTeamId: 7,
      isAuthenticated: true,
    })

    renderPage()

    expect(screen.queryByText(/acesso restrito/i)).not.toBeInTheDocument()
    expect(screen.getByText('Dashboard Suporte')).toBeInTheDocument()
  })

  it('ATENDENTE: "Saúde dos Planos" (SupportPlanHealthSection) não é renderizada', () => {
    mockedPermissions.mockReturnValue({
      role: 'ATENDENTE',
      isCoordenadorOuAcima: false,
      isGerentePlus: false,
      isAtendente: true,
      isGestor: false,
      primaryTeamId: 7,
      isAuthenticated: true,
    })

    renderPage()

    expect(screen.queryByTestId('plan-section')).not.toBeInTheDocument()
  })

  it('GERENTE: "Saúde dos Planos" (SupportPlanHealthSection) é renderizada (regressão)', () => {
    mockedPermissions.mockReturnValue({
      role: 'GERENTE',
      isCoordenadorOuAcima: true,
      isGerentePlus: true,
      isAtendente: false,
      isGestor: true,
      primaryTeamId: null,
      isAuthenticated: true,
    })

    renderPage()

    expect(screen.getByTestId('plan-section')).toBeInTheDocument()
  })

  it('ATENDENTE com primaryTeamId=7: scope inicial é "team:7" (nunca global)', () => {
    mockedPermissions.mockReturnValue({
      role: 'ATENDENTE',
      isCoordenadorOuAcima: false,
      isGerentePlus: false,
      isAtendente: true,
      isGestor: false,
      primaryTeamId: 7,
      isAuthenticated: true,
    })

    renderPage()

    expect(screen.getByTestId('dashboard-filters')).toHaveAttribute('data-scope', 'team:7')
    expect(mockedUseMetricsOverview).toHaveBeenCalledWith(
      expect.objectContaining({ scope: 'team:7' }),
    )
  })

  it('ATENDENTE sem equipe primária (primaryTeamId=null): scope fail-closed "team:0", nunca "management:suporte"', () => {
    mockedPermissions.mockReturnValue({
      role: 'ATENDENTE',
      isCoordenadorOuAcima: false,
      isGerentePlus: false,
      isAtendente: true,
      isGestor: false,
      primaryTeamId: null,
      isAuthenticated: true,
    })

    renderPage()

    expect(screen.getByTestId('dashboard-filters')).toHaveAttribute('data-scope', 'team:0')
    expect(mockedUseMetricsOverview).toHaveBeenCalledWith(
      expect.objectContaining({ scope: 'team:0' }),
    )
  })

  it('GERENTE: scope inicial é "management:suporte" (regressão)', () => {
    mockedPermissions.mockReturnValue({
      role: 'GERENTE',
      isCoordenadorOuAcima: true,
      isGerentePlus: true,
      isAtendente: false,
      isGestor: true,
      primaryTeamId: null,
      isAuthenticated: true,
    })

    renderPage()

    expect(screen.getByTestId('dashboard-filters')).toHaveAttribute(
      'data-scope',
      'management:suporte',
    )
  })
})
