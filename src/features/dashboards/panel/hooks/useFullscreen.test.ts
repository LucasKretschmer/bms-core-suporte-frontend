/**
 * Testes para useFullscreen (demanda 014).
 * Cobre: enter no documento, catch silencioso quando o FS é negado, exit,
 * reflexo de fullscreenchange e remoção de listener ao desmontar.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useFullscreen } from './useFullscreen'

describe('useFullscreen', () => {
  let originalRequestFullscreen: typeof document.documentElement.requestFullscreen
  let originalExitFullscreen: typeof document.exitFullscreen

  beforeEach(() => {
    originalRequestFullscreen = document.documentElement.requestFullscreen
    originalExitFullscreen = document.exitFullscreen

    document.documentElement.requestFullscreen = vi.fn().mockResolvedValue(undefined)
    document.exitFullscreen = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      get: () => null,
    })
  })

  afterEach(() => {
    document.documentElement.requestFullscreen = originalRequestFullscreen
    document.exitFullscreen = originalExitFullscreen
    vi.restoreAllMocks()
  })

  it('isSupported: true quando requestFullscreen está disponível', () => {
    const { result } = renderHook(() => useFullscreen())
    expect(result.current.isSupported).toBe(true)
  })

  it('enter(): chama requestFullscreen no documentElement', async () => {
    const { result } = renderHook(() => useFullscreen())
    await act(async () => {
      await result.current.enter()
    })
    expect(document.documentElement.requestFullscreen).toHaveBeenCalledTimes(1)
  })

  it('enter(): engole a rejeição quando o fullscreen é negado (não lança)', async () => {
    document.documentElement.requestFullscreen = vi
      .fn()
      .mockRejectedValue(new Error('denied'))
    const { result } = renderHook(() => useFullscreen())
    await act(async () => {
      // Não deve lançar.
      await expect(result.current.enter()).resolves.toBeUndefined()
    })
  })

  it('exit(): chama exitFullscreen quando há fullscreenElement', async () => {
    const el = document.createElement('div')
    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      get: () => el,
    })
    const { result } = renderHook(() => useFullscreen())
    await act(async () => {
      await result.current.exit()
    })
    expect(document.exitFullscreen).toHaveBeenCalledTimes(1)
  })

  it('exit(): no-op quando não há fullscreenElement', async () => {
    const { result } = renderHook(() => useFullscreen())
    await act(async () => {
      await result.current.exit()
    })
    expect(document.exitFullscreen).not.toHaveBeenCalled()
  })

  it('fullscreenchange com fullscreenElement=null → isFullscreen=false', async () => {
    const { result } = renderHook(() => useFullscreen())
    await act(async () => {
      document.dispatchEvent(new Event('fullscreenchange'))
    })
    expect(result.current.isFullscreen).toBe(false)
  })

  it('fullscreenchange com fullscreenElement não-null → isFullscreen=true', async () => {
    const el = document.createElement('div')
    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      get: () => el,
    })
    const { result } = renderHook(() => useFullscreen())
    await act(async () => {
      document.dispatchEvent(new Event('fullscreenchange'))
    })
    expect(result.current.isFullscreen).toBe(true)
  })

  it('desmontagem → listener de fullscreenchange é removido', () => {
    const removeSpy = vi.spyOn(document, 'removeEventListener')
    const { unmount } = renderHook(() => useFullscreen())
    unmount()
    const removedEvents = removeSpy.mock.calls.map((c) => c[0])
    expect(removedEvents).toContain('fullscreenchange')
  })
})
