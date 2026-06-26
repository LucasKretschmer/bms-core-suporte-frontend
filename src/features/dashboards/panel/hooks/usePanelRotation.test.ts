/**
 * Testes para usePanelRotation (demanda 014).
 * Cobre: início no scope corrente (initialIndex), avanço automático, loop,
 * exclusão de Onboarding (feita na página — aqui validamos que a lista recebida é respeitada),
 * teams=[] e teams.length<=1 não rotacionam.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePanelRotation } from './usePanelRotation'
import type { TeamDto } from '../../shared/types/metrics'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

const makeTeams = (n: number): TeamDto[] =>
  Array.from({ length: n }, (_, i) => ({
    id: i + 1,
    nome: `Equipe ${i + 1}`,
    gerencia: 'suporte',
  }))

/** Lista com Global (id sentinel 0) na primeira posição + equipes. */
const withGlobal = (n: number): TeamDto[] => [
  { id: 0, nome: 'Global', gerencia: null },
  ...makeTeams(n),
]

describe('usePanelRotation', () => {
  it('currentTeam é null quando teams=[]', () => {
    const onScopeChange = vi.fn()
    const { result } = renderHook(() =>
      usePanelRotation({ teams: [], intervalMs: 100, onScopeChange }),
    )
    expect(result.current.currentTeam).toBeNull()
  })

  it('não chama onScopeChange quando teams=[] (Onboarding, sem rotação)', () => {
    const onScopeChange = vi.fn()
    renderHook(() => usePanelRotation({ teams: [], intervalMs: 100, onScopeChange }))
    act(() => {
      vi.advanceTimersByTime(500)
    })
    expect(onScopeChange).not.toHaveBeenCalled()
  })

  it('não rotaciona quando há apenas 1 tela', () => {
    const onScopeChange = vi.fn()
    const { result } = renderHook(() =>
      usePanelRotation({ teams: withGlobal(0), intervalMs: 100, onScopeChange }),
    )
    act(() => {
      vi.advanceTimersByTime(500)
    })
    expect(result.current.currentIndex).toBe(0)
    expect(onScopeChange).not.toHaveBeenCalled()
  })

  it('inicia no índice 0 por padrão (Global)', () => {
    const teams = withGlobal(2)
    const onScopeChange = vi.fn()
    const { result } = renderHook(() =>
      usePanelRotation({ teams, intervalMs: 100, onScopeChange }),
    )
    expect(result.current.currentIndex).toBe(0)
    expect(result.current.currentTeam?.nome).toBe('Global')
  })

  it('inicia no scope corrente via initialIndex (espelha S._pi)', () => {
    const teams = withGlobal(3) // [Global, Equipe 1, Equipe 2, Equipe 3]
    const onScopeChange = vi.fn()
    const { result } = renderHook(() =>
      usePanelRotation({ teams, intervalMs: 100, initialIndex: 2, onScopeChange }),
    )
    expect(result.current.currentIndex).toBe(2)
    expect(result.current.currentTeam?.nome).toBe('Equipe 2')
  })

  it('clampa initialIndex fora da faixa', () => {
    const teams = withGlobal(1) // 2 itens
    const onScopeChange = vi.fn()
    const { result } = renderHook(() =>
      usePanelRotation({ teams, intervalMs: 100, initialIndex: 99, onScopeChange }),
    )
    expect(result.current.currentIndex).toBe(99 % 2)
  })

  it('avança para a próxima tela após intervalMs', () => {
    const teams = withGlobal(2)
    const onScopeChange = vi.fn()
    const { result } = renderHook(() =>
      usePanelRotation({ teams, intervalMs: 100, onScopeChange }),
    )
    act(() => {
      vi.advanceTimersByTime(100)
    })
    expect(result.current.currentIndex).toBe(1)
    expect(result.current.currentTeam?.nome).toBe('Equipe 1')
  })

  it('chama onScopeChange com team:{id} ao trocar para uma equipe', () => {
    const teams = withGlobal(2)
    const onScopeChange = vi.fn()
    renderHook(() => usePanelRotation({ teams, intervalMs: 100, onScopeChange }))
    act(() => {
      vi.advanceTimersByTime(100)
    })
    // teams[1] tem id=1
    expect(onScopeChange).toHaveBeenCalledWith('team:1')
  })

  it('faz loop: da última tela volta para Global com escopo management:suporte', () => {
    const teams = withGlobal(1) // [Global(0), Equipe 1(1)]
    const onScopeChange = vi.fn()
    const { result } = renderHook(() =>
      usePanelRotation({ teams, intervalMs: 100, onScopeChange }),
    )
    // tela 0 -> 1
    act(() => {
      vi.advanceTimersByTime(100)
    })
    expect(result.current.currentIndex).toBe(1)
    // tela 1 -> 0 (loop)
    act(() => {
      vi.advanceTimersByTime(100)
    })
    expect(result.current.currentIndex).toBe(0)
    expect(onScopeChange).toHaveBeenLastCalledWith('management:suporte')
  })

  it('cancela o timer ao desmontar (sem avanço após unmount)', () => {
    const teams = withGlobal(2)
    const onScopeChange = vi.fn()
    const { unmount } = renderHook(() =>
      usePanelRotation({ teams, intervalMs: 100, onScopeChange }),
    )
    unmount()
    act(() => {
      vi.advanceTimersByTime(500)
    })
    expect(onScopeChange).not.toHaveBeenCalled()
  })
})
