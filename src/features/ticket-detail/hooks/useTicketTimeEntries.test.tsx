import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { useTicketTimeEntries } from './useTicketTimeEntries'
import * as service from '../services/ticketDetailService'

vi.mock('../services/ticketDetailService', () => ({
  listTicketTimeEntries: vi.fn(),
  getTicketById: vi.fn(),
}))

function wrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
}

describe('useTicketTimeEntries', () => {
  beforeEach(() => {
    vi.mocked(service.listTicketTimeEntries).mockReset()
  })

  it('busca apontamentos por ticketId e retorna os dados', async () => {
    vi.mocked(service.listTicketTimeEntries).mockResolvedValue([
      {
        id: 'e1',
        userId: 'u1',
        agenteNome: 'Maria',
        serviceCategoryId: 'sc1',
        categorizacaoNome: 'Consultoria',
        billableOutsidePlan: false,
        status: 'COMPLETED',
        startTime: '2026-06-19T11:00:00Z',
        endTime: '2026-06-19T12:00:00Z',
        totalSeconds: 3600,
        note: null,
        pendingCategory: false,
        segments: [],
      },
    ])
    const { result } = renderHook(() => useTicketTimeEntries('t1'), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(service.listTicketTimeEntries).toHaveBeenCalledWith('t1')
    expect(result.current.data).toHaveLength(1)
  })

  it('não busca quando ticketId é vazio', () => {
    const { result } = renderHook(() => useTicketTimeEntries(''), { wrapper: wrapper() })
    expect(result.current.fetchStatus).toBe('idle')
    expect(service.listTicketTimeEntries).not.toHaveBeenCalled()
  })
})
