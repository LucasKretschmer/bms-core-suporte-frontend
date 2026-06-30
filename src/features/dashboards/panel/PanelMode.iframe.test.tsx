/**
 * Testes de integração do Modo Painel sob o iframe do BMS Core (demanda 051).
 *
 * Reproduz o bug "clico em Apresentar e nada acontece": o painel é ativado mas é
 * encerrado por um `fullscreenchange` logo após o `requestFullscreen` ser NEGADO
 * (cenário do iframe sem `allow="fullscreen"`). Aqui usamos o `useFullscreen` REAL
 * (sem mock) com `requestFullscreen` controlado, e um harness que espelha o
 * consumidor (`useState(false)` + botão "Apresentar" + <PanelMode/>).
 *
 * Os sub-hooks de rotação/scroll são mockados para isolar o fluxo de ativação/saída.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { useState } from 'react'
import { PanelMode } from './PanelMode'
import type { TeamDto, MetricsScope } from '../shared/types/metrics'

// Isola rotação/scroll — o foco é o fluxo ativar/encerrar do overlay.
vi.mock('./hooks/usePanelRotation', () => ({
  usePanelRotation: ({ teams }: { teams: TeamDto[] }) => ({
    currentTeam: teams[0] ?? null,
    currentIndex: 0,
  }),
}))
vi.mock('./hooks/useAutoScroll', () => ({
  useAutoScroll: () => ({ reset: vi.fn() }),
}))

const teams: TeamDto[] = [
  { id: 0, nome: 'Global', gerencia: null },
  { id: 1, nome: 'Suporte Tier 1', gerencia: 'suporte' },
]

/** Harness que espelha o consumidor (support/index.tsx e onboarding/index.tsx). */
function PanelHarness({ rotacao }: { rotacao: boolean }) {
  const [panelActive, setPanelActive] = useState(false)
  return (
    <div>
      {!panelActive && (
        <button type="button" onClick={() => setPanelActive(true)}>
          Apresentar
        </button>
      )}
      {panelActive && (
        <PanelMode
          isActive={panelActive}
          onExit={() => setPanelActive(false)}
          teams={rotacao ? teams : []}
          scope={
            (rotacao ? 'management:suporte' : 'management:onboarding') as MetricsScope
          }
          onScopeChange={() => {}}
          from="2026-06-01"
          to="2026-06-17"
          intervalMs={12000}
          scopeLabel={rotacao ? 'Suporte' : 'Onboarding'}
          liveStatus="open"
        >
          <div data-testid="dashboard-content">Seções do dashboard</div>
        </PanelMode>
      )}
    </div>
  )
}

describe('PanelMode no iframe (requestFullscreen negado) — demanda 051', () => {
  beforeEach(() => {
    // fullscreen permanece null (como no iframe sem allow="fullscreen").
    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      get: () => null,
    })
    // requestFullscreen presente porém SEMPRE rejeitado (igual ao iframe).
    Object.defineProperty(document.documentElement, 'requestFullscreen', {
      configurable: true,
      writable: true,
      value: vi.fn().mockRejectedValue(new Error('fullscreen blocked in iframe')),
    })
    Object.defineProperty(document, 'exitFullscreen', {
      configurable: true,
      writable: true,
      value: vi.fn().mockResolvedValue(undefined),
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('Suporte: clicar "Apresentar" ativa o overlay e ele PERMANECE mesmo com fullscreen negado', async () => {
    render(<PanelHarness rotacao />)

    await act(async () => {
      fireEvent.click(screen.getByText('Apresentar'))
    })

    // Overlay apareceu.
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByTestId('dashboard-content')).toBeInTheDocument()

    // Mesmo após um fullscreenchange espúrio (o pai pode sair do fullscreen), permanece.
    await act(async () => {
      fireEvent(document, new Event('fullscreenchange'))
    })
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(document.documentElement.requestFullscreen).toHaveBeenCalled()
  })

  it('Onboarding: clicar "Apresentar" ativa o overlay e ele PERMANECE mesmo com fullscreen negado', async () => {
    render(<PanelHarness rotacao={false} />)

    await act(async () => {
      fireEvent.click(screen.getByText('Apresentar'))
    })

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Onboarding' })).toBeInTheDocument()

    await act(async () => {
      fireEvent(document, new Event('fullscreenchange'))
    })
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('Escape encerra o overlay mesmo sem fullscreen', async () => {
    render(<PanelHarness rotacao />)
    await act(async () => {
      fireEvent.click(screen.getByText('Apresentar'))
    })
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    await act(async () => {
      fireEvent.keyDown(document, { key: 'Escape' })
    })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByText('Apresentar')).toBeInTheDocument()
  })

  it('botão X (Sair) encerra o overlay', async () => {
    render(<PanelHarness rotacao />)
    await act(async () => {
      fireEvent.click(screen.getByText('Apresentar'))
    })
    await act(async () => {
      fireEvent.click(screen.getByLabelText('Sair do Modo Painel (Esc)'))
    })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

describe('PanelMode com fullscreen REAL — saída por fullscreenchange (demanda 051)', () => {
  let fsElement: Element | null = null

  beforeEach(() => {
    fsElement = null
    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      get: () => fsElement,
    })
    // requestFullscreen SUCEDE: coloca o documento em fullscreen.
    Object.defineProperty(document.documentElement, 'requestFullscreen', {
      configurable: true,
      writable: true,
      value: vi.fn().mockImplementation(async () => {
        fsElement = document.documentElement
      }),
    })
    Object.defineProperty(document, 'exitFullscreen', {
      configurable: true,
      writable: true,
      value: vi.fn().mockImplementation(async () => {
        fsElement = null
      }),
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('após ENTRAR em fullscreen, sair (fullscreenchange) encerra o painel', async () => {
    render(<PanelHarness rotacao />)
    await act(async () => {
      fireEvent.click(screen.getByText('Apresentar'))
    })
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    // Usuário sai do fullscreen pelo browser → fullscreenElement volta a null.
    await act(async () => {
      fsElement = null
      fireEvent(document, new Event('fullscreenchange'))
    })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
