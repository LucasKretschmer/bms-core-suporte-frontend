/**
 * Testes para useFullscreen.
 * Cobre: enter/exit com suporte, fallback sem suporte, fullscreenchange e Escape.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useRef } from 'react'
import { useFullscreen } from './useFullscreen'

// Helper: cria um elemento com requestFullscreen mockado
function createMockElement() {
  const el = document.createElement('div')
  el.requestFullscreen = vi.fn().mockResolvedValue(undefined)
  return el
}

describe('useFullscreen', () => {
  let originalRequestFullscreen: typeof document.documentElement.requestFullscreen
  let originalExitFullscreen: typeof document.exitFullscreen
  let originalFullscreenElement: typeof document.fullscreenElement

  beforeEach(() => {
    originalRequestFullscreen = document.documentElement.requestFullscreen
    originalExitFullscreen = document.exitFullscreen
    originalFullscreenElement = document.fullscreenElement

    // Habilitar suporte por padrão
    document.documentElement.requestFullscreen = vi.fn().mockResolvedValue(undefined)
    document.exitFullscreen = vi.fn().mockResolvedValue(undefined)
    // fullscreenElement como getter writeable via defineProperty
    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      get: () => null,
    })
  })

  afterEach(() => {
    document.documentElement.requestFullscreen = originalRequestFullscreen
    document.exitFullscreen = originalExitFullscreen
    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      get: () => originalFullscreenElement,
    })
    vi.restoreAllMocks()
  })

  it('isSupported: true quando requestFullscreen está disponível', () => {
    const { result } = renderHook(() => {
      const ref = useRef<HTMLElement>(document.createElement('div'))
      return useFullscreen(ref)
    })
    expect(result.current.isSupported).toBe(true)
  })

  it('isSupported: false quando requestFullscreen não está disponível', () => {
    // Remover suporte
    Object.defineProperty(document.documentElement, 'requestFullscreen', {
      configurable: true,
      value: undefined,
    })
    const { result } = renderHook(() => {
      const ref = useRef<HTMLElement>(document.createElement('div'))
      return useFullscreen(ref)
    })
    expect(result.current.isSupported).toBe(false)
  })

  it('enter(): chama requestFullscreen no elemento quando suportado', async () => {
    const el = createMockElement()
    const { result } = renderHook(() => {
      const ref = useRef<HTMLElement>(el)
      return useFullscreen(ref)
    })

    await act(async () => {
      await result.current.enter()
    })

    expect(el.requestFullscreen).toHaveBeenCalledTimes(1)
  })

  it('enter(): define isFullscreen=true via fallback quando requestFullscreen não disponível', async () => {
    Object.defineProperty(document.documentElement, 'requestFullscreen', {
      configurable: true,
      value: undefined,
    })
    const el = document.createElement('div')
    const { result } = renderHook(() => {
      const ref = useRef<HTMLElement>(el)
      return useFullscreen(ref)
    })

    await act(async () => {
      await result.current.enter()
    })

    expect(result.current.isFullscreen).toBe(true)
  })

  it('exit(): chama exitFullscreen quando há fullscreenElement', async () => {
    const el = document.createElement('div')
    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      get: () => el,
    })

    const { result } = renderHook(() => {
      const ref = useRef<HTMLElement>(el)
      return useFullscreen(ref)
    })

    await act(async () => {
      await result.current.exit()
    })

    expect(document.exitFullscreen).toHaveBeenCalledTimes(1)
  })

  it('exit(): define isFullscreen=false no fallback (sem fullscreenElement)', async () => {
    Object.defineProperty(document.documentElement, 'requestFullscreen', {
      configurable: true,
      value: undefined,
    })
    const el = document.createElement('div')
    const { result } = renderHook(() => {
      const ref = useRef<HTMLElement>(el)
      return useFullscreen(ref)
    })

    // Primeiro entra no modo overlay
    await act(async () => {
      await result.current.enter()
    })
    expect(result.current.isFullscreen).toBe(true)

    // Depois sai
    await act(async () => {
      await result.current.exit()
    })
    expect(result.current.isFullscreen).toBe(false)
  })

  it('fullscreenchange com fullscreenElement=null → isFullscreen=false', async () => {
    const el = createMockElement()
    const { result } = renderHook(() => {
      const ref = useRef<HTMLElement>(el)
      return useFullscreen(ref)
    })

    // Simular saída do fullscreen
    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      get: () => null,
    })

    await act(async () => {
      document.dispatchEvent(new Event('fullscreenchange'))
    })

    expect(result.current.isFullscreen).toBe(false)
  })

  it('fullscreenchange com fullscreenElement não-null → isFullscreen=true', async () => {
    const el = createMockElement()
    const { result } = renderHook(() => {
      const ref = useRef<HTMLElement>(el)
      return useFullscreen(ref)
    })

    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      get: () => el,
    })

    await act(async () => {
      document.dispatchEvent(new Event('fullscreenchange'))
    })

    expect(result.current.isFullscreen).toBe(true)
  })

  it('keydown Escape → exit() é chamado', async () => {
    const el = document.createElement('div')
    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      get: () => el,
    })

    renderHook(() => {
      const ref = useRef<HTMLElement>(el)
      return useFullscreen(ref)
    })

    await act(async () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    })

    expect(document.exitFullscreen).toHaveBeenCalled()
  })

  it('desmontagem → listeners de evento são removidos', () => {
    const addSpy = vi.spyOn(document, 'addEventListener')
    const removeSpy = vi.spyOn(document, 'removeEventListener')

    const el = document.createElement('div')
    const { unmount } = renderHook(() => {
      const ref = useRef<HTMLElement>(el)
      return useFullscreen(ref)
    })

    unmount()

    // removeEventListener deve ter sido chamado para os dois eventos
    const removedEvents = removeSpy.mock.calls.map((c) => c[0])
    expect(removedEvents).toContain('fullscreenchange')
    expect(removedEvents).toContain('keydown')

    addSpy.mockRestore()
    removeSpy.mockRestore()
  })
})
