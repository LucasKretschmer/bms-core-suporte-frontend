import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { useTimeEntryMutations, toWorkBlocksPayload } from './useTimeEntryMutations'
import * as service from '../services/timeEntryService'
import type { TimeEntryFormValues } from '../types/timeEntrySchema'

vi.mock('../services/timeEntryService', () => ({
  createManualTimeEntry: vi.fn(),
  updateManualTimeEntry: vi.fn(),
  deleteTimeEntry: vi.fn(),
}))

function wrapper(client: QueryClient) {
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
}

function form(overrides: Partial<TimeEntryFormValues> = {}): TimeEntryFormValues {
  return {
    // Valores do form vêm de comboboxes (string); o hook converte para number no payload.
    userId: '1',
    serviceCategoryId: '2',
    billableOutsidePlan: false,
    note: '',
    works: [{ start: '2026-06-19T08:00', end: '2026-06-19T09:00' }],
    ...overrides,
  }
}

describe('toWorkBlocksPayload', () => {
  it('converte cada bloco datetime-local em ISO Z', () => {
    const result = toWorkBlocksPayload([
      { start: '2026-06-19T08:00', end: '2026-06-19T09:00' },
    ])
    expect(result[0].start).toMatch(/Z$/)
    expect(result[0].end).toMatch(/Z$/)
    // Preserva o instante (1h de diferença).
    const dur = new Date(result[0].end).getTime() - new Date(result[0].start).getTime()
    expect(dur).toBe(60 * 60 * 1000)
  })
})

describe('useTimeEntryMutations', () => {
  beforeEach(() => {
    vi.mocked(service.createManualTimeEntry).mockReset()
    vi.mocked(service.updateManualTimeEntry).mockReset()
    vi.mocked(service.deleteTimeEntry).mockReset()
  })

  it('create monta payload com works em ISO Z, userId e gera Idempotency-Key', async () => {
    vi.mocked(service.createManualTimeEntry).mockResolvedValue({ id: 1 })
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const { result } = renderHook(() => useTimeEntryMutations(10), {
      wrapper: wrapper(client),
    })

    await result.current.create.mutateAsync(form())

    const [payload, key] = vi.mocked(service.createManualTimeEntry).mock.calls[0]
    expect(payload.ticketId).toBe(10)
    expect(payload.userId).toBe(1)
    expect(payload.serviceCategoryId).toBe(2)
    expect(payload.works[0].start).toMatch(/Z$/)
    expect(typeof key).toBe('string')
    expect(key.length).toBeGreaterThan(0)
  })

  it('create invalida as queries do detalhe no sucesso', async () => {
    vi.mocked(service.createManualTimeEntry).mockResolvedValue({ id: 1 })
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const spy = vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHook(() => useTimeEntryMutations(10), {
      wrapper: wrapper(client),
    })

    await result.current.create.mutateAsync(form())

    await waitFor(() => {
      expect(spy).toHaveBeenCalledWith({ queryKey: ['ticket-time-entries', 10] })
      expect(spy).toHaveBeenCalledWith({ queryKey: ['ticket-detail', 10] })
    })
  })

  it('update chama o service com id e payload sem userId', async () => {
    vi.mocked(service.updateManualTimeEntry).mockResolvedValue({ id: 1 })
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const { result } = renderHook(() => useTimeEntryMutations(10), {
      wrapper: wrapper(client),
    })

    await result.current.update.mutateAsync({ id: 1, values: form({ billableOutsidePlan: true }) })

    const [id, payload] = vi.mocked(service.updateManualTimeEntry).mock.calls[0]
    expect(id).toBe(1)
    expect(payload.billableOutsidePlan).toBe(true)
    expect(payload).not.toHaveProperty('userId')
  })

  it('remove chama deleteTimeEntry com o id', async () => {
    vi.mocked(service.deleteTimeEntry).mockResolvedValue()
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const { result } = renderHook(() => useTimeEntryMutations(10), {
      wrapper: wrapper(client),
    })

    await result.current.remove.mutateAsync(1)
    expect(service.deleteTimeEntry).toHaveBeenCalledWith(1)
  })
})
