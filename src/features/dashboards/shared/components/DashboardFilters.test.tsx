/**
 * Testes de DashboardFilters.
 *
 * AP-FRONTEND-004 — Retorno de foco (BUG-001):
 * Garante que a prop apresentarButtonRef é conectada ao botão "Apresentar",
 * permitindo que handleExitPanel foque o botão ao sair do Modo Painel.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import React, { createRef } from 'react'
import { DashboardFilters } from './DashboardFilters'
import { usePermissions } from '../../../../hooks/usePermissions'
import type { TeamDto } from '../types/metrics'

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

// Mock mais completo do Combobox — expõe disabled/options via atributos data-* para os
// testes de trava de equipe do ATENDENTE (118.6), sem quebrar os testes existentes que só
// checam o label.
vi.mock('../../../../components/ui/Combobox', () => ({
  Combobox: ({
    label,
    disabled,
    options,
    placeholder,
  }: {
    label: string
    disabled?: boolean
    options: { value: string; label: string }[]
    placeholder?: string
  }) => (
    <div
      data-testid="team-combobox"
      data-disabled={disabled ? 'true' : 'false'}
      data-options-count={options.length}
    >
      {label}
      <span data-testid="team-combobox-placeholder">{placeholder}</span>
      <ul>
        {options.map((o) => (
          <li key={o.value}>{o.label}</li>
        ))}
      </ul>
    </div>
  ),
}))

// Mock de usePermissions — controlável por teste (vi.fn())
vi.mock('../../../../hooks/usePermissions', () => ({
  usePermissions: vi.fn(),
}))

const mockedUsePermissions = vi.mocked(usePermissions)

const defaultProps = {
  from: '2026-06-01',
  to: '2026-06-17',
  onPeriodChange: vi.fn(),
}

// Perfil padrão dos testes existentes (não relacionados a RBAC): usuário coordenador,
// pode ver o botão Apresentar.
function setCoordenador() {
  mockedUsePermissions.mockReturnValue({
    role: 'COORDENADOR',
    isCoordenadorOuAcima: true,
    isGerentePlus: false,
    isAtendente: false,
    isGestor: true,
    primaryTeamId: null,
    isAuthenticated: true,
  })
}

describe('DashboardFilters — botão Apresentar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setCoordenador()
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

// ── DashboardFilters — trava de equipe para ATENDENTE (118.6) ────────────────

describe('DashboardFilters — trava de equipe para ATENDENTE (118.6)', () => {
  const teams: TeamDto[] = [
    { id: 7, nome: 'Equipe Sete', gerencia: 'suporte' },
    { id: 9, nome: 'Equipe Nove', gerencia: 'suporte' },
  ]

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('ATENDENTE com equipe primária: combobox fica desabilitado e só oferece a própria equipe', () => {
    mockedUsePermissions.mockReturnValue({
      role: 'ATENDENTE',
      isCoordenadorOuAcima: false,
      isGerentePlus: false,
      isAtendente: true,
      isGestor: false,
      primaryTeamId: 7,
      isAuthenticated: true,
    })

    render(
      <DashboardFilters
        {...defaultProps}
        teams={teams}
        selectedScope="team:7"
        onScopeChange={vi.fn()}
      />,
    )

    const combo = screen.getByTestId('team-combobox')
    const optionsList = within(combo).getByRole('list')
    expect(combo).toHaveAttribute('data-disabled', 'true')
    expect(combo).toHaveAttribute('data-options-count', '1')
    expect(within(optionsList).getByText('Equipe Sete')).toBeInTheDocument()
    expect(within(optionsList).queryByText('Global')).not.toBeInTheDocument()
    expect(within(optionsList).queryByText('Equipe Nove')).not.toBeInTheDocument()
  })

  it('gestor (não-atendente): combobox habilitado, com "Global" + todas as equipes (regressão)', () => {
    mockedUsePermissions.mockReturnValue({
      role: 'COORDENADOR',
      isCoordenadorOuAcima: true,
      isGerentePlus: false,
      isAtendente: false,
      isGestor: true,
      primaryTeamId: null,
      isAuthenticated: true,
    })

    render(
      <DashboardFilters
        {...defaultProps}
        teams={teams}
        selectedScope="management:suporte"
        onScopeChange={vi.fn()}
      />,
    )

    const combo = screen.getByTestId('team-combobox')
    const optionsList = within(combo).getByRole('list')
    expect(combo).toHaveAttribute('data-disabled', 'false')
    expect(combo).toHaveAttribute('data-options-count', '3')
    expect(within(optionsList).getByText('Global')).toBeInTheDocument()
    expect(within(optionsList).getByText('Equipe Sete')).toBeInTheDocument()
    expect(within(optionsList).getByText('Equipe Nove')).toBeInTheDocument()
  })

  it('ATENDENTE sem equipe primária (fail-closed): combobox desabilitado e sem opções selecionáveis', () => {
    mockedUsePermissions.mockReturnValue({
      role: 'ATENDENTE',
      isCoordenadorOuAcima: false,
      isGerentePlus: false,
      isAtendente: true,
      isGestor: false,
      primaryTeamId: null,
      isAuthenticated: true,
    })

    render(
      <DashboardFilters
        {...defaultProps}
        teams={teams}
        selectedScope="team:0"
        onScopeChange={vi.fn()}
      />,
    )

    const combo = screen.getByTestId('team-combobox')
    expect(combo).toHaveAttribute('data-disabled', 'true')
    expect(combo).toHaveAttribute('data-options-count', '0')
    expect(screen.queryByText('Global')).not.toBeInTheDocument()
    expect(screen.getByTestId('team-combobox-placeholder')).toHaveTextContent('Sem equipe atribuída')
  })
})
