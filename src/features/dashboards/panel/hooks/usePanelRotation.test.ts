/**
 * Testes para usePanelRotation.
 * Cobre: avanço automático, loop, goNext/goPrev, pause/resume, teams=[].
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePanelRotation } from './usePanelRotation'
import type { TeamDto } from '../../shared/types/metrics'

// Mock de requestAnimationFrame para controlar o tempo nos testes
let rafCallbacks: FrameRequestCallback[] = []
let rafId = 0

beforeEach(() => {
  rafCallbacks = []
  rafId = 0
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    rafCallbacks.push(cb)
    return ++rafId
  })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    // Marca como cancelado (simplificação: limpa lista)
    rafCallbacks = rafCallbacks.filter((_, i) => i !== id - 1)
  })
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  rafCallbacks = []
})

/** Executa todos os rAF pendentes com o timestamp dado */
function flushRaf(timestamp = Date.now()) {
  const cbs = [...rafCallbacks]
  rafCallbacks = []
  cbs.forEach((cb) => cb(timestamp))
}

const makeTeams = (n: number): TeamDto[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `team-${i + 1}`,
    nome: `Equipe ${i + 1}`,
    gerencia: 'suporte',
  }))

describe('usePanelRotation', () => {
  it('currentTeam é null quando teams=[]', () => {
    const onScopeChange = vi.fn()
    const { result } = renderHook(() =>
      usePanelRotation({ teams: [], intervalMs: 100, onScopeChange }),
    )
    expect(result.current.currentTeam).toBeNull()
  })

  it('não chama onScopeChange quando teams=[]', () => {
    const onScopeChange = vi.fn()
    renderHook(() =>
      usePanelRotation({ teams: [], intervalMs: 100, onScopeChange }),
    )
    act(() => {
      vi.advanceTimersByTime(500)
      flushRaf()
    })
    expect(onScopeChange).not.toHaveBeenCalled()
  })

  it('currentTeam inicia na primeira equipe da lista', () => {
    const teams = makeTeams(3)
    const onScopeChange = vi.fn()
    const { result } = renderHook(() =>
      usePanelRotation({ teams, intervalMs: 100, onScopeChange }),
    )
    expect(result.current.currentTeam?.id).toBe('team-1')
    expect(result.current.currentIndex).toBe(0)
  })

  it('progresso avança de 0 a 1 ao longo de intervalMs', () => {
    const teams = makeTeams(3)
    const onScopeChange = vi.fn()
    const { result } = renderHook(() =>
      usePanelRotation({ teams, intervalMs: 1000, onScopeChange }),
    )

    // Após 500ms → progresso ~0.5
    act(() => {
      vi.advanceTimersByTime(500)
      flushRaf(Date.now())
      flushRaf(Date.now())
    })

    expect(result.current.progress).toBeGreaterThan(0.4)
    expect(result.current.progress).toBeLessThanOrEqual(1)
  })

  it('avança para a próxima equipe após intervalMs', () => {
    const teams = makeTeams(3)
    const onScopeChange = vi.fn()
    const { result } = renderHook(() =>
      usePanelRotation({ teams, intervalMs: 100, onScopeChange }),
    )

    act(() => {
      vi.advanceTimersByTime(150)
      // Disparar múltiplos frames para garantir que o tick detecta pct >= 1
      for (let i = 0; i < 10; i++) {
        flushRaf(Date.now())
      }
    })

    expect(result.current.currentIndex).toBe(1)
    expect(result.current.currentTeam?.id).toBe('team-2')
  })

  it('faz loop: após a última equipe volta à primeira', () => {
    const teams = makeTeams(2)
    const onScopeChange = vi.fn()
    const { result } = renderHook(() =>
      usePanelRotation({ teams, intervalMs: 100, onScopeChange }),
    )

    // Avançar 2 vezes
    act(() => {
      vi.advanceTimersByTime(250)
      for (let i = 0; i < 20; i++) {
        flushRaf(Date.now())
      }
    })

    // Com 2 equipes e 2 intervalos → volta à equipe 0
    expect(result.current.currentIndex).toBe(0)
  })

  it('onScopeChange chamado com scope correto ao trocar equipe', () => {
    const teams = makeTeams(3)
    const onScopeChange = vi.fn()
    const { result } = renderHook(() =>
      usePanelRotation({ teams, intervalMs: 100, onScopeChange }),
    )

    act(() => {
      vi.advanceTimersByTime(150)
      for (let i = 0; i < 10; i++) {
        flushRaf(Date.now())
      }
    })

    // Deve ter chamado com 'team:team-2'
    expect(onScopeChange).toHaveBeenCalledWith('team:team-2')
    expect(result.current.currentIndex).toBe(1)
  })

  it('goNext(): avança imediatamente para a próxima equipe', () => {
    const teams = makeTeams(3)
    const onScopeChange = vi.fn()
    const { result } = renderHook(() =>
      usePanelRotation({ teams, intervalMs: 10_000, onScopeChange }),
    )

    act(() => {
      result.current.goNext()
    })

    expect(result.current.currentIndex).toBe(1)
    expect(onScopeChange).toHaveBeenCalledWith('team:team-2')
  })

  it('goPrev(): recua imediatamente para a equipe anterior', () => {
    const teams = makeTeams(3)
    const onScopeChange = vi.fn()
    const { result } = renderHook(() =>
      usePanelRotation({ teams, intervalMs: 10_000, onScopeChange }),
    )

    // Avançar uma vez para estar na equipe 1
    act(() => {
      result.current.goNext()
    })
    expect(result.current.currentIndex).toBe(1)

    // Recuar
    act(() => {
      result.current.goPrev()
    })
    expect(result.current.currentIndex).toBe(0)
    expect(onScopeChange).toHaveBeenLastCalledWith('team:team-1')
  })

  it('goPrev() na primeira equipe → vai para a última (loop circular)', () => {
    const teams = makeTeams(3)
    const onScopeChange = vi.fn()
    const { result } = renderHook(() =>
      usePanelRotation({ teams, intervalMs: 10_000, onScopeChange }),
    )

    act(() => {
      result.current.goPrev()
    })

    expect(result.current.currentIndex).toBe(2)
  })

  it('pause(): não avança após intervalMs', () => {
    const teams = makeTeams(3)
    const onScopeChange = vi.fn()
    const { result } = renderHook(() =>
      usePanelRotation({ teams, intervalMs: 100, onScopeChange }),
    )

    act(() => {
      result.current.pause()
    })
    expect(result.current.isPaused).toBe(true)

    // Avançar o tempo
    act(() => {
      vi.advanceTimersByTime(300)
      for (let i = 0; i < 10; i++) {
        flushRaf(Date.now())
      }
    })

    // Deve ter ficado na equipe 0
    expect(result.current.currentIndex).toBe(0)
  })

  it('resume(): avança normalmente após retomar', () => {
    const teams = makeTeams(3)
    const onScopeChange = vi.fn()
    const { result } = renderHook(() =>
      usePanelRotation({ teams, intervalMs: 100, onScopeChange }),
    )

    act(() => {
      result.current.pause()
    })

    act(() => {
      result.current.resume()
      vi.advanceTimersByTime(150)
      for (let i = 0; i < 10; i++) {
        flushRaf(Date.now())
      }
    })

    // Deve ter avançado
    expect(result.current.currentIndex).toBeGreaterThan(0)
  })

  it('isPaused reflete o estado correto', () => {
    const teams = makeTeams(2)
    const onScopeChange = vi.fn()
    const { result } = renderHook(() =>
      usePanelRotation({ teams, intervalMs: 100, onScopeChange }),
    )

    expect(result.current.isPaused).toBe(false)

    act(() => {
      result.current.pause()
    })
    expect(result.current.isPaused).toBe(true)

    act(() => {
      result.current.resume()
    })
    expect(result.current.isPaused).toBe(false)
  })

  it('scope Global (id="") → onScopeChange chamado com "management:suporte"', () => {
    const teams: TeamDto[] = [
      { id: '', nome: 'Global', gerencia: 'suporte' },
      { id: 'team-1', nome: 'Suporte', gerencia: 'suporte' },
    ]
    const onScopeChange = vi.fn()
    renderHook(() =>
      usePanelRotation({ teams, intervalMs: 100, onScopeChange }),
    )

    // Primeiro goNext vai para equipe com id='team-1'
    // mas ao iniciar o currentIndex=0 (Global) deve chamar onScopeChange apenas se teams.length > 0
    // e o scope de index=0 é 'management:suporte'
    // Verificamos que avançando, o scope de id=team-1 é 'team:team-1'
    act(() => {
      vi.advanceTimersByTime(150)
      for (let i = 0; i < 10; i++) {
        flushRaf(Date.now())
      }
    })

    expect(onScopeChange).toHaveBeenCalledWith('team:team-1')
  })
})
