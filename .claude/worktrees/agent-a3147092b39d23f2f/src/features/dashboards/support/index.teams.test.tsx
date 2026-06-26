/**
 * Regressão #6 — o combobox de Equipe do Dashboard Suporte deve listar TODAS as
 * equipes retornadas por listTeams(), inclusive as sincronizadas (gerencia=null).
 *
 * Antes da correção, o filtro client-side `.filter(gerencia === 'suporte')` zerava
 * a lista para equipes com gerencia=null. Após FE-1, não há mais esse filtro.
 *
 * Arquivo separado do index.test.tsx porque aquele stub-a o Combobox e o listTeams;
 * aqui usamos o Combobox real e equipes não-vazias.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import DashboardSuportePage from './index'
import * as reportsService from '../../reports/shared/services/reportsService'
import { usePermissions } from '../../../hooks/usePermissions'
import type { TeamDto } from '../../reports/shared/types/reports'

vi.mock('../../../hooks/usePermissions')

// Seções pesadas (cada uma dispara queries próprias) — fora do escopo do teste.
vi.mock('./components/SupportKpiSection', () => ({ SupportKpiSection: () => null }))
vi.mock('./components/SupportMovimentacaoSection', () => ({ SupportMovimentacaoSection: () => null }))
vi.mock('./components/SupportStatusSection', () => ({ SupportStatusSection: () => null }))
vi.mock('./components/SupportCategorySection', () => ({ SupportCategorySection: () => null }))
vi.mock('./components/SupportSlaSection', () => ({ SupportSlaSection: () => null }))
vi.mock('./components/SupportPlanHealthSection', () => ({ SupportPlanHealthSection: () => null }))
vi.mock('../shared/components/DrillDownModal', () => ({ DrillDownModal: () => null }))
vi.mock('../panel/PanelMode', () => ({ PanelMode: () => null }))

vi.mock('../shared/hooks/useMetricsOverview', () => ({
  useMetricsOverview: () => ({ data: undefined, isLoading: false, isError: false, refetch: vi.fn() }),
}))
vi.mock('../shared/hooks/useDrillDownRows', () => ({
  useDrillDownRows: () => ({ enable: vi.fn(), disable: vi.fn() }),
}))
vi.mock('../shared/hooks/useMetricsStream', () => ({
  useMetricsStream: () => ({ status: 'idle', pause: vi.fn(), resume: vi.fn() }),
}))

// ClientCombobox/PlanCombobox dentro de DashboardFilters fazem queries — stub.
vi.mock('../../reports/shared/components/ClientCombobox', () => ({ ClientCombobox: () => null }))
vi.mock('../../reports/shared/components/PlanCombobox', () => ({ PlanCombobox: () => null }))

const mockedPermissions = vi.mocked(usePermissions)

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    React.createElement(QueryClientProvider, { client }, React.createElement(DashboardSuportePage)),
  )
}

describe('DashboardSuportePage — filtro de Equipe (#6)', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    mockedPermissions.mockReturnValue({
      role: 'COORDENADOR',
      isCoordenadorOuAcima: true,
      isGerentePlus: false,
      isAtendente: false,
      isAuthenticated: true,
    })
  })

  it('lista todas as equipes mesmo com gerencia=null (regressão do bug)', async () => {
    const teams: TeamDto[] = [
      { id: 1, nome: 'Suporte Tier 1', gerencia: 'suporte' },
      { id: 2, nome: 'Equipe Sincronizada', gerencia: null },
      { id: 3, nome: 'Onboarding', gerencia: 'onboarding' },
    ]
    vi.spyOn(reportsService, 'listTeams').mockResolvedValue(teams)

    renderPage()

    // Abre o combobox de Equipe.
    const combo = await screen.findByRole('combobox', { name: /equipe/i })
    fireEvent.click(combo)

    await waitFor(() => {
      expect(screen.getByText('Suporte Tier 1')).toBeInTheDocument()
    })
    expect(screen.getByText('Equipe Sincronizada')).toBeInTheDocument()
    expect(screen.getByText('Onboarding')).toBeInTheDocument()
  })
})
