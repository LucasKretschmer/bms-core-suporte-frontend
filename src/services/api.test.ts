import { describe, expect, it, vi, beforeEach } from 'vitest'
import axios, { AxiosHeaders, type InternalAxiosRequestConfig } from 'axios'

// Mock do ensureSession (lock único de refresh) e do tokenStore
vi.mock('../utils/ensureSession', () => ({
  ensureSession: vi.fn(),
}))
vi.mock('../utils/tokenStore', () => ({
  tokenStore: {
    set: vi.fn(),
    get: vi.fn(),
    clear: vi.fn(),
    isValid: vi.fn(),
  },
}))

import { api } from './api'
import { ensureSession } from '../utils/ensureSession'
import { tokenStore } from '../utils/tokenStore'

/** Acessa o handler de erro do interceptor de response registrado em api.ts. */
type RejectedHandler = (error: unknown) => unknown
function getResponseRejectedHandler(): RejectedHandler {
  // O Axios guarda os handlers internamente; pegamos o último registrado.
  const handlers = (
    api.interceptors.response as unknown as {
      handlers: Array<{ rejected: RejectedHandler } | null>
    }
  ).handlers
  const handler = handlers.filter(Boolean).pop()
  if (!handler) throw new Error('Handler de response não registrado')
  return handler.rejected
}

function buildConfig(url: string): InternalAxiosRequestConfig {
  return {
    url,
    headers: new AxiosHeaders(),
  } as InternalAxiosRequestConfig
}

function build401(url: string): unknown {
  return new axios.AxiosError(
    'Unauthorized',
    'ERR_BAD_REQUEST',
    buildConfig(url),
    {},
    {
      status: 401,
      data: {},
      statusText: 'Unauthorized',
      headers: {},
      config: buildConfig(url),
    },
  )
}

describe('api — instância e interceptor 401', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('cria a instância com withCredentials: true', () => {
    expect(api.defaults.withCredentials).toBe(true)
  })

  it('(a) 401 em request de negócio → refresh uma vez → refaz request com novo Bearer', async () => {
    const handler = getResponseRejectedHandler()
    vi.mocked(ensureSession).mockResolvedValueOnce(null)
    vi.mocked(tokenStore.isValid).mockReturnValue(true)
    vi.mocked(tokenStore.get).mockReturnValue('novo-token')

    const requestSpy = vi.spyOn(api, 'request').mockResolvedValue({ data: 'ok' } as never)

    const result = await handler(build401('/api/v1/tickets'))

    expect(ensureSession).toHaveBeenCalledTimes(1)
    expect(requestSpy).toHaveBeenCalledTimes(1)
    const retried = requestSpy.mock.calls[0][0] as InternalAxiosRequestConfig
    expect(retried._retry).toBe(true)
    expect(retried.headers.Authorization).toBe('Bearer novo-token')
    expect(result).toEqual({ data: 'ok' })

    requestSpy.mockRestore()
  })

  it('(b) refresh falha → dispara auth:logout e rejeita', async () => {
    const handler = getResponseRejectedHandler()
    vi.mocked(ensureSession).mockResolvedValueOnce(null)
    vi.mocked(tokenStore.isValid).mockReturnValue(false)

    const eventSpy = vi.fn()
    window.addEventListener('auth:logout', eventSpy)

    await expect(handler(build401('/api/v1/tickets'))).rejects.toBeDefined()

    expect(eventSpy).toHaveBeenCalledTimes(1)
    expect(tokenStore.clear).toHaveBeenCalled()

    window.removeEventListener('auth:logout', eventSpy)
  })

  it('(c) NÃO tenta refresh para /auth/login, /auth/refresh, /auth/logout (anti-loop)', async () => {
    const handler = getResponseRejectedHandler()
    const eventSpy = vi.fn()
    window.addEventListener('auth:logout', eventSpy)

    for (const path of [
      '/api/v1/auth/login',
      '/api/v1/auth/refresh',
      '/api/v1/auth/logout',
    ]) {
      await expect(handler(build401(path))).rejects.toBeDefined()
    }

    expect(ensureSession).not.toHaveBeenCalled()
    // emitLogout disparado em cada uma
    expect(eventSpy).toHaveBeenCalledTimes(3)

    window.removeEventListener('auth:logout', eventSpy)
  })

  it('(d) _retry impede 2º refresh para a mesma request', async () => {
    const handler = getResponseRejectedHandler()
    const eventSpy = vi.fn()
    window.addEventListener('auth:logout', eventSpy)

    const error = build401('/api/v1/tickets') as { config: InternalAxiosRequestConfig }
    error.config._retry = true

    await expect(handler(error)).rejects.toBeDefined()

    expect(ensureSession).not.toHaveBeenCalled()
    expect(eventSpy).toHaveBeenCalledTimes(1)

    window.removeEventListener('auth:logout', eventSpy)
  })

  it('(e) duas requests 401 simultâneas → ensureSession concentra em um único refresh', async () => {
    const handler = getResponseRejectedHandler()
    // ensureSession já garante lock único; aqui validamos que cada 401 chama
    // ensureSession (que internamente memoiza). Simulamos sucesso.
    vi.mocked(ensureSession).mockResolvedValue(null)
    vi.mocked(tokenStore.isValid).mockReturnValue(true)
    vi.mocked(tokenStore.get).mockReturnValue('t')
    const requestSpy = vi.spyOn(api, 'request').mockResolvedValue({ data: 'ok' } as never)

    await Promise.all([
      handler(build401('/api/v1/a')),
      handler(build401('/api/v1/b')),
    ])

    // O lock real vive dentro do ensureSession (testado em T2);
    // aqui ambas as requests passam pelo mesmo ponto único.
    expect(ensureSession).toHaveBeenCalledTimes(2)
    expect(requestSpy).toHaveBeenCalledTimes(2)

    requestSpy.mockRestore()
  })

  it('erro não-401 é apenas propagado (sem refresh)', async () => {
    const handler = getResponseRejectedHandler()
    const err500 = new axios.AxiosError(
      'Server Error',
      'ERR_BAD_RESPONSE',
      buildConfig('/api/v1/tickets'),
      {},
      { status: 500, data: {}, statusText: 'ISE', headers: {}, config: buildConfig('/x') },
    )

    await expect(handler(err500)).rejects.toBe(err500)
    expect(ensureSession).not.toHaveBeenCalled()
  })
})
