import { describe, expect, it, vi, beforeEach } from 'vitest'
import {
  createManualTimeEntry,
  deleteTimeEntry,
  updateManualTimeEntry,
} from './timeEntryService'
import { api } from '../../../services/api'

vi.mock('../../../services/api', () => ({
  api: { post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}))

const mockedPost = vi.mocked(api.post)
const mockedPut = vi.mocked(api.put)
const mockedDelete = vi.mocked(api.delete)

describe('timeEntryService', () => {
  beforeEach(() => {
    mockedPost.mockReset()
    mockedPut.mockReset()
    mockedDelete.mockReset()
  })

  it('createManualTimeEntry envia Idempotency-Key e desempacota ApiResponse', async () => {
    mockedPost.mockResolvedValueOnce({ data: { data: { id: 'e1' }, message: 'ok' } })
    const payload = {
      ticketId: 't1',
      userId: 'u1',
      serviceCategoryId: 'sc1',
      billableOutsidePlan: false,
      works: [{ start: '2026-06-19T11:00:00Z', end: '2026-06-19T12:00:00Z' }],
    }
    const result = await createManualTimeEntry(payload, 'key-123')
    expect(mockedPost).toHaveBeenCalledWith(
      '/api/v1/time-entries/manual',
      payload,
      { headers: { 'Idempotency-Key': 'key-123' } },
    )
    expect(result).toEqual({ id: 'e1' })
  })

  it('updateManualTimeEntry chama PUT /manual/{id}', async () => {
    mockedPut.mockResolvedValueOnce({ data: { data: { id: 'e1' }, message: 'ok' } })
    await updateManualTimeEntry('e1', {
      serviceCategoryId: 'sc1',
      billableOutsidePlan: true,
      works: [{ start: '2026-06-19T11:00:00Z', end: '2026-06-19T12:00:00Z' }],
    })
    expect(mockedPut).toHaveBeenCalledWith(
      '/api/v1/time-entries/manual/e1',
      expect.objectContaining({ serviceCategoryId: 'sc1', billableOutsidePlan: true }),
    )
  })

  it('deleteTimeEntry chama DELETE /{id}', async () => {
    mockedDelete.mockResolvedValueOnce({ status: 204 })
    await deleteTimeEntry('e1')
    expect(mockedDelete).toHaveBeenCalledWith('/api/v1/time-entries/e1')
  })
})
