/**
 * Testes de DashboardFilters.
 *
 * AP-FRONTEND-004 — Retorno de foco (BUG-001):
 * Garante que a prop apresentarButtonRef é conectada ao botão "Apresentar",
 * permitindo que handleExitPanel foque o botão ao sair do Modo Painel.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React, { createRef } from 'react'
import { DashboardFilters } from './DashboardFilters'

// Mocks de componentes de filtro para isolar DashboardFilters
vi.mock('../../../reports/shared/components/PeriodFilter', () => ({
  PeriodFilter: ({ from, to }: { from: string | null; to: string | null; onChange: () => void }) => (
    <div data-testid="period-filter">
      {from} {to}
    </div>
  ),
}))

vi.mock('../../../reports/shared/components/ClientCombobox', () => ({
  ClientCombobox: () => <div data-testid="client-combobox" />,
}))

vi.mock('../../../reports/shared/components/PlanCombobox', () => ({
  PlanCombobox: () => <div data-testid="plan-combobox" />,
}))

vi.mock('../../../../components/ui/Combobox', () => ({
  Combobox: ({ label }: { label: string }) => (
    <div data-testid="team-combobox">{label}</div>
  ),
}))

// Mock de usePermissions — usuário coordenador (pode ver o botão Apresentar)
vi.mock('../../../../hooks/usePermissions', () => ({
  usePermissions: () => ({
    isCoordenadorOuAcima: true,
    isAtendente: false,
    isAuthenticated: true,
    role: 'COORDENADOR',
  }),
}))

const defaultProps = {
  from: '2026-06-01',
  to: '2026-06-17',
  onPeriodChange: vi.fn(),
}

describe('DashboardFilters — botão Apresentar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renderiza o botão "Apresentar" quando showPresentar e onPresentar são passados', () => {
    render(
      <DashboardFilters
        {...defaultProps}
        showPresentar
        onPresentar={vi.fn()}
      />,
    )
    expect(screen.getByText('Apresentar')).toBeInTheDocument()
  })

  it('não renderiza o botão "Apresentar" quando showPresentar=false', () => {
    render(
      <DashboardFilters
        {...defaultProps}
        showPresentar={false}
        onPresentar={vi.fn()}
      />,
    )
    expect(screen.queryByText('Apresentar')).not.toBeInTheDocument()
  })

  it('não renderiza o botão "Apresentar" quando onPresentar não é passado', () => {
    render(
      <DashboardFilters
        {...defaultProps}
        showPresentar
      />,
    )
    expect(screen.queryByText('Apresentar')).not.toBeInTheDocument()
  })

  it('chama onPresentar ao clicar no botão Apresentar', () => {
    const onPresentar = vi.fn()
    render(
      <DashboardFilters
        {...defaultProps}
        showPresentar
        onPresentar={onPresentar}
      />,
    )
    fireEvent.click(screen.getByText('Apresentar'))
    expect(onPresentar).toHaveBeenCalledTimes(1)
  })

  // ── AP-FRONTEND-004 ─────────────────────────────────────────────────────────

  it('AP-FRONTEND-004: apresentarButtonRef conecta ao botão DOM real', () => {
    const ref = createRef<HTMLButtonElement>()
    render(
      <DashboardFilters
        {...defaultProps}
        showPresentar
        onPresentar={vi.fn()}
        apresentarButtonRef={ref}
      />,
    )
    const button = screen.getByText('Apresentar').closest('button')
    expect(ref.current).not.toBeNull()
    expect(ref.current).toBe(button)
  })

  it('AP-FRONTEND-004: document.activeElement aponta para o botão Apresentar após focus() via ref', () => {
    const ref = createRef<HTMLButtonElement>()
    render(
      <DashboardFilters
        {...defaultProps}
        showPresentar
        onPresentar={vi.fn()}
        apresentarButtonRef={ref}
      />,
    )

    // Simula o que handleExitPanel faz ao sair do Modo Painel
    ref.current?.focus()

    expect(document.activeElement).toBe(ref.current)
    expect(document.activeElement?.textContent).toContain('Apresentar')
  })

  it('AP-FRONTEND-004: apresentarButtonRef=undefined não quebra o componente', () => {
    // Retrocompat — quem não passa a prop não é afetado
    expect(() =>
      render(
        <DashboardFilters
          {...defaultProps}
          showPresentar
          onPresentar={vi.fn()}
          // apresentarButtonRef não passado
        />,
      ),
    ).not.toThrow()
  })
})
