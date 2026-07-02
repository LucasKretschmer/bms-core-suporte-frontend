import { describe, expect, it, vi, beforeEach } from 'vitest'
import {
  cancelTimeEntry,
  createManualTimeEntry,
  restoreTimeEntry,
  updateManualTimeEntry,
} from './timeEntryService'
import { api } from '../../../services/api'

vi.mock('../../../services/api', () => ({
  api: { post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}))

const mockedPost = vi.mocked(api.post)
const mockedPut = vi.mocked(api.put)

describe('timeEntryService', () => {
  beforeEach(() => {
    mockedPost.mockReset()
    mockedPut.mockReset()
  })

  it('createManualTimeEntry envia Idempotency-Key e desempacota ApiResponse', async () => {
    mockedPost.mockResolvedValueOnce({ data: { data: { id: 1 }, message: 'ok' } })
    const payload = {
      ticketId: 10,
      userId: 1,
      serviceCategoryId: 2,
      billableOutsidePlan: false,
      works: [{ start: '2026-06-19T11:00:00Z', end: '2026-06-19T12:00:00Z' }],
    }
    const result = await createManualTimeEntry(payload, 'key-123')
    expect(mockedPost).toHaveBeenCalledWith(
      '/api/v1/time-entries/manual',
      payload,
      { headers: { 'Idempotency-Key': 'key-123' } },
    )
    expect(result).toEqual({ id: 1 })
  })

  it('updateManualTimeEntry chama PUT /manual/{id}', async () => {
    mockedPut.mockResolvedValueOnce({ data: { data: { id: 1 }, message: 'ok' } })
    await updateManualTimeEntry(1, {
      serviceCategoryId: 2,
      billableOutsidePlan: true,
      works: [{ start: '2026-06-19T11:00:00Z', end: '2026-06-19T12:00:00Z' }],
    })
    expect(mockedPut).toHaveBeenCalledWith(
      '/api/v1/time-entries/manual/1',
      expect.objectContaining({ serviceCategoryId: 2, billableOutsidePlan: true }),
    )
  })

  it('cancelTimeEntry faz POST /{id}/cancel com note no body e Idempotency-Key', async () => {
    mockedPost.mockResolvedValueOnce({ data: { data: { id: 1 }, message: 'ok' } })
    const result = await cancelTimeEntry(1, 'Lançamento duplicado na cobrança', 'key-cancel')
    expect(mockedPost).toHaveBeenCalledWith(
      '/api/v1/time-entries/1/cancel',
      { note: 'Lançamento duplicado na cobrança' },
      { headers: { 'Idempotency-Key': 'key-cancel' } },
    )
    expect(result).toEqual({ id: 1 })
  })

  it('restoreTimeEntry faz POST /{id}/restore sem body e com Idempotency-Key', async () => {
    mockedPost.mockResolvedValueOnce({ data: { data: { id: 2 }, message: 'ok' } })
    const result = await restoreTimeEntry(2, 'key-restore')
    expect(mockedPost).toHaveBeenCalledWith('/api/v1/time-entries/2/restore', undefined, {
      headers: { 'Idempotency-Key': 'key-restore' },
    })
    expect(result).toEqual({ id: 2 })
  })
})
