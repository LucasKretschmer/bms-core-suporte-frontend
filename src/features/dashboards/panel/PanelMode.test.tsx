/**
 * Testes para PanelMode.
 * Cobre: não renderiza quando isActive=false, renderiza overlay quando true,
 * esconde chrome (sem filtros), mostra nome da equipe em destaque, botão de saída.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PanelMode } from './PanelMode'
import type { TeamDto, MetricsScope } from '../shared/types/metrics'

// Mock dos hooks de painel para isolar o PanelMode
vi.mock('./hooks/useFullscreen', () => ({
  useFullscreen: () => ({
    isFullscreen: false,
    enter: vi.fn().mockResolvedValue(undefined),
    exit: vi.fn().mockResolvedValue(undefined),
    isSupported: false, // fallback overlay
  }),
}))

vi.mock('./hooks/usePanelRotation', () => ({
  usePanelRotation: ({ teams }: { teams: TeamDto[]; intervalMs?: number; onScopeChange: (s: MetricsScope) => void }) => ({
    currentTeam: teams[0] ?? null,
    currentIndex: 0,
    progress: 0,
    goNext: vi.fn(),
    goPrev: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    isPaused: false,
  }),
}))

vi.mock('./hooks/useAutoScroll', () => ({
  useAutoScroll: () => ({
    reset: vi.fn(),
  }),
}))

vi.mock('./components/PanelHeader', () => ({
  PanelHeader: ({ teamName, period }: { teamName: string; scope: MetricsScope; liveStatus: string; period: string; progress: number }) => (
    <header data-testid="panel-header">
      <h1>{teamName}</h1>
      <span>{period}</span>
    </header>
  ),
}))

const baseTeams: TeamDto[] = [
  { id: 0, nome: 'Global', gerencia: 'suporte' },
  { id: 1, nome: 'Suporte Tier 1', gerencia: 'suporte' },
]

const defaultProps = {
  isActive: true,
  onExit: vi.fn(),
  teams: baseTeams,
  scope: 'management:suporte' as MetricsScope,
  onScopeChange: vi.fn(),
  from: '2026-06-01',
  to: '2026-06-17',
  intervalMs: 12000,
  liveStatus: 'open' as const,
}

describe('PanelMode', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('não renderiza nada quando isActive=false', () => {
    render(
      <PanelMode {...defaultProps} isActive={false}>
        <div data-testid="dashboard-content">Conteúdo</div>
      </PanelMode>,
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByTestId('dashboard-content')).not.toBeInTheDocument()
  })

  it('renderiza overlay com role="dialog" quando isActive=true', () => {
    render(
      <PanelMode {...defaultProps}>
        <div>Conteúdo</div>
      </PanelMode>,
    )
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('overlay tem aria-modal="true" e aria-label="Modo Painel"', () => {
    render(
      <PanelMode {...defaultProps}>
        <div>Conteúdo</div>
      </PanelMode>,
    )
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAttribute('aria-label', 'Modo Painel')
  })

  it('renderiza o conteúdo filho (dashboard sem chrome)', () => {
    render(
      <PanelMode {...defaultProps}>
        <div data-testid="dashboard-content">Seções do dashboard</div>
      </PanelMode>,
    )
    expect(screen.getByTestId('dashboard-content')).toBeInTheDocument()
    expect(screen.getByText('Seções do dashboard')).toBeInTheDocument()
  })

  it('renderiza PanelHeader com nome da equipe corrente', () => {
    render(
      <PanelMode {...defaultProps}>
        <div>Conteúdo</div>
      </PanelMode>,
    )
    expect(screen.getByTestId('panel-header')).toBeInTheDocument()
    // A primeira equipe é 'Global' (id='')
    expect(screen.getByText('Global')).toBeInTheDocument()
  })

  it('exibe nome da equipe específica quando teams=[{id: "team-1", nome: "Suporte Tier 1"}]', () => {
    const teams: TeamDto[] = [{ id: 'team-1', nome: 'Suporte Tier 1', gerencia: 'suporte' }]
    render(
      <PanelMode {...defaultProps} teams={teams} scope="team:team-1">
        <div>Conteúdo</div>
      </PanelMode>,
    )
    expect(screen.getByText('Suporte Tier 1')).toBeInTheDocument()
  })

  it('exibe "Onboarding" como nome quando teams=[] e scope=management:onboarding', () => {
    render(
      <PanelMode
        {...defaultProps}
        teams={[]}
        scope="management:onboarding"
      >
        <div>Conteúdo</div>
      </PanelMode>,
    )
    expect(screen.getByText('Onboarding')).toBeInTheDocument()
  })

  it('botão de saída está presente com aria-label correto', () => {
    render(
      <PanelMode {...defaultProps}>
        <div>Conteúdo</div>
      </PanelMode>,
    )
    expect(screen.getByLabelText('Sair do Modo Painel (Esc)')).toBeInTheDocument()
  })

  it('clique no botão de saída chama onExit', () => {
    const onExit = vi.fn()
    render(
      <PanelMode {...defaultProps} onExit={onExit}>
        <div>Conteúdo</div>
      </PanelMode>,
    )
    fireEvent.click(screen.getByLabelText('Sair do Modo Painel (Esc)'))
    expect(onExit).toHaveBeenCalledTimes(1)
  })

  it('renderiza controles prev/next quando há mais de 1 equipe', () => {
    render(
      <PanelMode {...defaultProps} teams={baseTeams}>
        <div>Conteúdo</div>
      </PanelMode>,
    )
    expect(screen.getByLabelText('Equipe anterior')).toBeInTheDocument()
    expect(screen.getByLabelText('Próxima equipe')).toBeInTheDocument()
  })

  it('não renderiza controles prev/next quando teams=[]', () => {
    render(
      <PanelMode {...defaultProps} teams={[]}>
        <div>Conteúdo</div>
      </PanelMode>,
    )
    expect(screen.queryByLabelText('Equipe anterior')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Próxima equipe')).not.toBeInTheDocument()
  })

  it('não renderiza controles prev/next quando há apenas 1 equipe', () => {
    render(
      <PanelMode {...defaultProps} teams={[baseTeams[0]]}>
        <div>Conteúdo</div>
      </PanelMode>,
    )
    expect(screen.queryByLabelText('Equipe anterior')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Próxima equipe')).not.toBeInTheDocument()
  })

  it('formata o período corretamente (YYYY-MM-DD → DD/MM/YYYY)', () => {
    render(
      <PanelMode {...defaultProps} from="2026-06-01" to="2026-06-17">
        <div>Conteúdo</div>
      </PanelMode>,
    )
    // O mock do PanelHeader renderiza o period em um <span>
    expect(screen.getByText('01/06/2026 – 17/06/2026')).toBeInTheDocument()
  })

  it('exibe "—" como período quando from ou to são null', () => {
    render(
      <PanelMode {...defaultProps} from={null} to={null}>
        <div>Conteúdo</div>
      </PanelMode>,
    )
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('overlay cobre toda a tela (fixed inset-0 z-50)', () => {
    render(
      <PanelMode {...defaultProps}>
        <div>Conteúdo</div>
      </PanelMode>,
    )
    const dialog = screen.getByRole('dialog')
    expect(dialog.className).toContain('fixed')
    expect(dialog.className).toContain('inset-0')
    expect(dialog.className).toContain('z-50')
  })
})
