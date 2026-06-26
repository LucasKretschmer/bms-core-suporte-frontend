/**
 * Testes para useAutoScroll.
 * Cobre: enabled=false (sem scroll), fases 35/30/35, reset(), prefers-reduced-motion.
 *
 * Nota: jsdom não implementa window.matchMedia — é mockado em cada teste/suite.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useRef } from 'react'
import { useAutoScroll } from './useAutoScroll'

// Mock de matchMedia sem motion reduzido (padrão)
function mockMatchMedia(prefersReduced = false) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches: prefersReduced && query === '(prefers-reduced-motion: reduce)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  )
}

// Mock de requestAnimationFrame com controle de timestamp
let rafCallbacks: FrameRequestCallback[] = []

function setupRafMock() {
  rafCallbacks = []
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    rafCallbacks.push(cb)
    return rafCallbacks.length
  })
  vi.stubGlobal('cancelAnimationFrame', () => {
    rafCallbacks = []
  })
}

/** Dispara frames rAF com o timestamp dado */
function flushRaf(timestamp: number) {
  const cbs = [...rafCallbacks]
  rafCallbacks = []
  cbs.forEach((cb) => cb(timestamp))
}

/** Cria um container com scrollHeight e clientHeight definidos */
function createScrollContainer(scrollHeight = 1000, clientHeight = 300): HTMLDivElement {
  const el = document.createElement('div')
  Object.defineProperties(el, {
    scrollHeight: { configurable: true, get: () => scrollHeight },
    clientHeight: { configurable: true, get: () => clientHeight },
    scrollTop: {
      configurable: true,
      writable: true,
      value: 0,
    },
  })
  return el
}

describe('useAutoScroll', () => {
  beforeEach(() => {
    setupRafMock()
    mockMatchMedia(false) // sem prefers-reduced-motion por padrão
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    rafCallbacks = []
  })

  it('enabled=false → não inicia rAF e scrollTop permanece 0', () => {
    const container = createScrollContainer()
    const { result } = renderHook(() => {
      const ref = useRef<HTMLElement>(container)
      return useAutoScroll({ containerRef: ref, totalMs: 1000, enabled: false })
    })

    expect(rafCallbacks).toHaveLength(0)
    expect(container.scrollTop).toBe(0)
    expect(result.current.reset).toBeTypeOf('function')
  })

  it('enabled=true → inicia rAF imediatamente', () => {
    const container = createScrollContainer()
    renderHook(() => {
      const ref = useRef<HTMLElement>(container)
      return useAutoScroll({ containerRef: ref, totalMs: 1000, enabled: true })
    })
    expect(rafCallbacks.length).toBeGreaterThan(0)
  })

  it('fase 1 (0–35%): scrollTop permanece em 0', () => {
    const totalMs = 1000
    const container = createScrollContainer()
    renderHook(() => {
      const ref = useRef<HTMLElement>(container)
      return useAutoScroll({ containerRef: ref, totalMs, enabled: true })
    })

    // Primeiro frame define startTime = 0
    act(() => { flushRaf(0) })
    // Frame com elapsed = 30% (dentro da fase 1: 0–35%)
    act(() => { flushRaf(300) })
    expect(container.scrollTop).toBe(0)
  })

  it('fase 2 (35–65%): scrollTop > 0 (rolando)', () => {
    const totalMs = 1000
    const container = createScrollContainer(1000, 300)
    renderHook(() => {
      const ref = useRef<HTMLElement>(container)
      return useAutoScroll({ containerRef: ref, totalMs, enabled: true })
    })

    // Primeiro frame: define startTime = 0
    act(() => { flushRaf(0) })
    // Frame com elapsed = 50% (dentro da fase 2: 35–65%)
    act(() => { flushRaf(500) })
    expect(container.scrollTop).toBeGreaterThan(0)
    expect(container.scrollTop).toBeLessThan(700)
  })

  it('fase 3 (65–100%): scrollTop igual ao máximo', () => {
    const totalMs = 1000
    const scrollHeight = 1000
    const clientHeight = 300
    const maxScroll = scrollHeight - clientHeight // 700
    const container = createScrollContainer(scrollHeight, clientHeight)
    renderHook(() => {
      const ref = useRef<HTMLElement>(container)
      return useAutoScroll({ containerRef: ref, totalMs, enabled: true })
    })

    // Definir startTime
    act(() => { flushRaf(0) })
    // Frame com elapsed = 90% (fase 3: 65–100%)
    act(() => { flushRaf(900) })
    expect(container.scrollTop).toBe(maxScroll)
  })

  it('ao completar totalMs → reinicia (scrollTop volta a 0)', () => {
    const totalMs = 1000
    const container = createScrollContainer()
    renderHook(() => {
      const ref = useRef<HTMLElement>(container)
      return useAutoScroll({ containerRef: ref, totalMs, enabled: true })
    })

    // Primeiro frame: startTime = 0
    act(() => { flushRaf(0) })
    // Frame além de totalMs → loop
    act(() => { flushRaf(1100) })
    // Após loop: scrollTop = 0 e novo frame foi agendado
    expect(container.scrollTop).toBe(0)
    expect(rafCallbacks.length).toBeGreaterThan(0)
  })

  it('reset(): scrollTop volta a 0', () => {
    const totalMs = 1000
    const container = createScrollContainer(1000, 300)
    const { result } = renderHook(() => {
      const ref = useRef<HTMLElement>(container)
      return useAutoScroll({ containerRef: ref, totalMs, enabled: true })
    })

    // Avançar para a fase 3
    act(() => { flushRaf(0) })
    act(() => { flushRaf(900) }) // fase 3 → scrollTop = maxScroll
    expect(container.scrollTop).toBe(700)

    // Reset
    act(() => { result.current.reset() })
    expect(container.scrollTop).toBe(0)
  })

  it('prefers-reduced-motion: pula para o final sem animação', () => {
    // Re-aplicar o mock com prefers-reduced-motion ativado
    mockMatchMedia(true)

    const totalMs = 1000
    const container = createScrollContainer(1000, 300)

    renderHook(() => {
      const ref = useRef<HTMLElement>(container)
      return useAutoScroll({ containerRef: ref, totalMs, enabled: true })
    })

    // Frame na fase 1 (normalmente scrollTop=0, mas reduced-motion pula para final)
    act(() => { flushRaf(0) })
    act(() => { flushRaf(100) }) // 10% — fase 1 normalmente

    // Com prefers-reduced-motion, deve ir direto para o final
    expect(container.scrollTop).toBe(700) // maxScroll
  })

  it('desmontagem → rAF é cancelado', () => {
    const container = createScrollContainer()
    const { unmount } = renderHook(() => {
      const ref = useRef<HTMLElement>(container)
      return useAutoScroll({ containerRef: ref, totalMs: 1000, enabled: true })
    })

    expect(rafCallbacks.length).toBeGreaterThan(0)

    act(() => { unmount() })

    // cancelAnimationFrame limpa a lista no nosso stub
    expect(rafCallbacks).toHaveLength(0)
  })

  it('mudar de enabled=false para enabled=true → inicia o scroll', () => {
    const container = createScrollContainer()
    const { rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) => {
        const ref = useRef<HTMLElement>(container)
        return useAutoScroll({ containerRef: ref, totalMs: 1000, enabled })
      },
      { initialProps: { enabled: false } },
    )

    expect(rafCallbacks).toHaveLength(0)

    rerender({ enabled: true })
    expect(rafCallbacks.length).toBeGreaterThan(0)
  })
})
