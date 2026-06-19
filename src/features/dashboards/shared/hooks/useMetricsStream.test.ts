/**
 * Testes do useMetricsStream.
 * Estratégia: EventSource é substituído por um mock síncrono.
 * vi.useFakeTimers() é usado apenas para testar o debounce de 2s
 * sem conflito com waitFor (que usa timers reais internamente).
 * Por isso, os testes que precisam de waitFor NÃO usam fake timers.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

// ── Mock do tokenStore ────────────────────────────────────────────────────────

const MOCK_TOKEN = 'test-token-xyz'

vi.mock('../../../../utils/tokenStore', () => ({
  tokenStore: {
    get: () => MOCK_TOKEN,
    isValid: () => true,
    set: vi.fn(),
    clear: vi.fn(),
  },
}))

// ── import.meta.env ───────────────────────────────────────────────────────────

vi.stubEnv('VITE_API_URL', 'http://localhost:5001')

// ── MockEventSource ───────────────────────────────────────────────────────────

type AnyListener = (e: Event) => void

class MockEventSource {
  static instances: MockEventSource[] = []

  url: string
  readyState = 0
  onopen: (() => void) | null = null
  onerror: (() => void) | null = null
  private _listeners: Map<string, AnyListener[]> = new Map()

  constructor(url: string) {
    this.url = url
    MockEventSource.instances.push(this)
  }

  addEventListener(type: string, fn: AnyListener) {
    const arr = this._listeners.get(type) ?? []
    arr.push(fn)
    this._listeners.set(type, arr)
  }

  removeEventListener(type: string, fn: AnyListener) {
    const arr = this._listeners.get(type) ?? []
    this._listeners.set(type, arr.filter((l) => l !== fn))
  }

  close() {
    this.readyState = 2
  }

  /** Simula abertura da conexão SSE */
  triggerOpen() {
    this.readyState = 1
    this.onopen?.()
  }

  /** Simula erro de conexão */
  triggerError() {
    this.onerror?.()
  }

  /** Dispara evento customizado (tipo relevante) */
  triggerEvent(type: string) {
    const listeners = this._listeners.get(type) ?? []
    const e = new MessageEvent(type, { data: '' })
    listeners.forEach((l) => l(e))
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function createWrapper(qc: QueryClient) {
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children)
}

// ── Testes ────────────────────────────────────────────────────────────────────

describe('useMetricsStream', () => {
  let originalEventSource: typeof EventSource
  let qc: QueryClient
  let invalidateSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    MockEventSource.instances = []
    originalEventSource = globalThis.EventSource
    // @ts-expect-error substituindo EventSource nativo
    globalThis.EventSource = MockEventSource

    qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    invalidateSpy = vi.spyOn(qc, 'invalidateQueries')
  })

  afterEach(() => {
    globalThis.EventSource = originalEventSource
    vi.clearAllMocks()
    vi.useRealTimers()
    qc.clear()
  })

  async function render(scope = 'management:suporte' as const) {
    const { useMetricsStream } = await import('./useMetricsStream')
    return renderHook(() => useMetricsStream(scope), {
      wrapper: createWrapper(qc),
    })
  }

  it('status inicia como "connecting"', async () => {
    const { result } = await render()
    expect(result.current.status).toBe('connecting')
  })

  it('URL contém scope e token corretos', async () => {
    await render('management:suporte')
    // O useEffect do hook roda na renderização inicial
    const instance = MockEventSource.instances[0]
    expect(instance).toBeDefined()
    expect(instance.url).toContain('/api/v1/metrics/stream')
    expect(instance.url).toContain('scope=management%3Asuporte')
    expect(instance.url).toContain(`token=${MOCK_TOKEN}`)
  })

  it('URL base vem de VITE_API_URL', async () => {
    await render()
    const instance = MockEventSource.instances[0]
    expect(instance.url).toContain('http://localhost:5001')
  })

  it('status passa para "open" ao abrir conexão', async () => {
    const { result } = await render()
    const instance = MockEventSource.instances[0]
    expect(instance).toBeDefined()

    act(() => {
      instance.triggerOpen()
    })

    expect(result.current.status).toBe('open')
  })

  it('status passa para "error" em falha de conexão', async () => {
    const { result } = await render()
    const instance = MockEventSource.instances[0]

    act(() => {
      instance.triggerError()
    })

    expect(result.current.status).toBe('error')
  })

  it('evento relevante dispara invalidação após debounce de 2s', async () => {
    vi.useFakeTimers()
    await render()
    const instance = MockEventSource.instances[0]

    act(() => {
      instance.triggerEvent('TIME_ENTRY_SAVED')
    })

    // Antes dos 2s: sem invalidação
    expect(invalidateSpy).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(2000)
    })

    // Após 2s: invalidações disparadas
    expect(invalidateSpy).toHaveBeenCalled()
  })

  it('múltiplos eventos em 2s = apenas um batch de invalidação', async () => {
    vi.useFakeTimers()
    await render()
    const instance = MockEventSource.instances[0]

    // 3 eventos rápidos
    act(() => {
      instance.triggerEvent('TIME_ENTRY_SAVED')
      instance.triggerEvent('TICKET_STATUS_CHANGED')
      instance.triggerEvent('TICKET_CREATED')
    })

    // Antes dos 2s: zero chamadas ainda
    expect(invalidateSpy).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(2000)
    })

    // Exatamente 3 invalidações (1 por queryKey), não 9 (3 eventos x 3 queries)
    expect(invalidateSpy).toHaveBeenCalledTimes(3)
  })

  it('pause() impede invalidação mesmo após debounce', async () => {
    vi.useFakeTimers()
    const { result } = await render()
    const instance = MockEventSource.instances[0]

    act(() => {
      result.current.pause()
      instance.triggerEvent('TIME_ENTRY_SAVED')
    })

    act(() => {
      vi.advanceTimersByTime(2000)
    })

    expect(invalidateSpy).not.toHaveBeenCalled()
  })

  it('resume() restaura invalidações após pause()', async () => {
    vi.useFakeTimers()
    const { result } = await render()
    const instance = MockEventSource.instances[0]

    // Pausa e emite — não deve invalidar
    act(() => {
      result.current.pause()
      instance.triggerEvent('TIME_ENTRY_SAVED')
    })
    act(() => vi.advanceTimersByTime(2000))
    expect(invalidateSpy).not.toHaveBeenCalled()

    // Retoma e emite — deve invalidar
    act(() => {
      result.current.resume()
      instance.triggerEvent('TICKET_CREATED')
    })
    act(() => vi.advanceTimersByTime(2000))
    expect(invalidateSpy).toHaveBeenCalled()
  })

  it('EventSource é fechado ao desmontar o hook', async () => {
    const { unmount } = await render()
    const instance = MockEventSource.instances[0]
    expect(instance).toBeDefined()
    // Antes de desmontar, EventSource está aberto (readyState 0 = CONNECTING)
    expect(instance.readyState).not.toBe(2)

    unmount()

    // Após desmonte, o cleanup chama es.close() → readyState 2 = CLOSED
    expect(instance.readyState).toBe(2)
  })
})
