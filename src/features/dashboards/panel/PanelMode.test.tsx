/**
 * Testes para PanelMode (demanda 014).
 * Cobre: não renderiza quando isActive=false; overlay com role=dialog;
 * título da equipe DENTRO do conteúdo rolável; ausência de chrome (sem setas/progress);
 * saída por botão, Escape e fullscreenchange.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PanelMode } from './PanelMode'
import type { TeamDto, MetricsScope } from '../shared/types/metrics'

// Mock dos hooks de painel para isolar o PanelMode.
vi.mock('./hooks/useFullscreen', () => ({
  useFullscreen: () => ({
    isFullscreen: false,
    enter: vi.fn().mockResolvedValue(undefined),
    exit: vi.fn().mockResolvedValue(undefined),
    isSupported: false,
  }),
}))

vi.mock('./hooks/usePanelRotation', () => ({
  usePanelRotation: ({ teams }: { teams: TeamDto[] }) => ({
    currentTeam: teams[0] ?? null,
    currentIndex: 0,
  }),
}))

vi.mock('./hooks/useAutoScroll', () => ({
  useAutoScroll: () => ({ reset: vi.fn() }),
}))

const baseTeams: TeamDto[] = [
  { id: 0, nome: 'Global', gerencia: null },
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
  scopeLabel: 'Suporte',
  liveStatus: 'open' as const,
}

describe('PanelMode', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      get: () => null,
    })
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
    const dialog = screen.getByRole('dialog')
    expect(dialog).toBeInTheDocument()
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
  })

  it('exibe o nome da equipe corrente em destaque (Global)', () => {
    render(
      <PanelMode {...defaultProps}>
        <div>Conteúdo</div>
      </PanelMode>,
    )
    expect(screen.getByRole('heading', { name: 'Global' })).toBeInTheDocument()
  })

  it('exibe nome de equipe específica quando há equipe', () => {
    const teams: TeamDto[] = [{ id: 7, nome: 'Suporte Tier 1', gerencia: 'suporte' }]
    render(
      <PanelMode {...defaultProps} teams={teams} scope="team:7">
        <div>Conteúdo</div>
      </PanelMode>,
    )
    expect(screen.getByRole('heading', { name: 'Suporte Tier 1' })).toBeInTheDocument()
  })

  it('exibe "Onboarding" quando teams=[] e scope=management:onboarding', () => {
    render(
      <PanelMode {...defaultProps} teams={[]} scope="management:onboarding" scopeLabel="Onboarding">
        <div>Conteúdo</div>
      </PanelMode>,
    )
    expect(screen.getByRole('heading', { name: 'Onboarding' })).toBeInTheDocument()
  })

  it('o título da equipe fica DENTRO do conteúdo rolável (rola junto)', () => {
    render(
      <PanelMode {...defaultProps}>
        <div data-testid="dashboard-content">Conteúdo</div>
      </PanelMode>,
    )
    const heading = screen.getByRole('heading', { name: 'Global' })
    const content = screen.getByTestId('dashboard-content')
    // O container rolável (com overflow-y-auto) deve conter AMBOS: título e seções.
    const scroller = content.parentElement as HTMLElement
    expect(scroller.className).toContain('overflow-y-auto')
    expect(scroller.contains(heading)).toBe(true)
  })

  it('inclui o rótulo de escopo + período no título', () => {
    render(
      <PanelMode {...defaultProps}>
        <div>Conteúdo</div>
      </PanelMode>,
    )
    expect(screen.getByText('Suporte · 01/06/2026 – 17/06/2026')).toBeInTheDocument()
  })

  it('NÃO renderiza setas prev/next (divergência removida do protótipo)', () => {
    render(
      <PanelMode {...defaultProps}>
        <div>Conteúdo</div>
      </PanelMode>,
    )
    expect(screen.queryByLabelText('Equipe anterior')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Próxima equipe')).not.toBeInTheDocument()
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

  it('Escape encerra o painel (mesmo sem fullscreen)', () => {
    const onExit = vi.fn()
    render(
      <PanelMode {...defaultProps} onExit={onExit}>
        <div>Conteúdo</div>
      </PanelMode>,
    )
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onExit).toHaveBeenCalledTimes(1)
  })

  it('fullscreenchange SEM ter entrado em fullscreen NÃO encerra o painel — BUG 051 (iframe)', () => {
    // No iframe do BMS Core o requestFullscreen é negado: nunca entramos em fullscreen.
    // O mock de useFullscreen resolve enter() sem setar fullscreenElement (segue null no
    // beforeEach). Um fullscreenchange espúrio (ex.: o pai sai do fullscreen) NÃO pode
    // derrubar o painel — esse era o "clico e nada acontece".
    const onExit = vi.fn()
    render(
      <PanelMode {...defaultProps} onExit={onExit}>
        <div>Conteúdo</div>
      </PanelMode>,
    )
    fireEvent(document, new Event('fullscreenchange'))
    expect(onExit).not.toHaveBeenCalled()
  })

  it('fullscreenchange COM fullscreenElement (entrou) NÃO encerra o painel', () => {
    const onExit = vi.fn()
    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      get: () => document.body,
    })
    render(
      <PanelMode {...defaultProps} onExit={onExit}>
        <div>Conteúdo</div>
      </PanelMode>,
    )
    fireEvent(document, new Event('fullscreenchange'))
    expect(onExit).not.toHaveBeenCalled()
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
