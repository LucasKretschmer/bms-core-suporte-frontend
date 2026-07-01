import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { useClientTickets } from './useClientTickets'
import * as service from '../services/clientTicketsService'

vi.mock('../services/clientTicketsService', () => ({
  listClientTickets: vi.fn(),
}))

function wrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
}

describe('useClientTickets', () => {
  beforeEach(() => {
    vi.mocked(service.listClientTickets).mockReset()
    vi.mocked(service.listClientTickets).mockResolvedValue({
      items: [],
      totalCount: 0,
      page: 1,
      pageSize: 25,
      totalPages: 0,
    })
  })

  it('passa o clientId ao service', async () => {
    renderHook(() => useClientTickets(1), { wrapper: wrapper() })
    await waitFor(() => {
      expect(service.listClientTickets).toHaveBeenCalledWith(
        expect.objectContaining({ clientId: 1 }),
      )
    })
  })

  it('inicia com status array vazio e sortDirection desc', () => {
    const { result } = renderHook(() => useClientTickets(1), { wrapper: wrapper() })
    expect(result.current.filters.status).toEqual([])
    expect(result.current.sortDirection).toBe('desc')
  })

  it('inicia com teamId e owner arrays vazios (070)', () => {
    const { result } = renderHook(() => useClientTickets(1), { wrapper: wrapper() })
    expect(result.current.filters.teamId).toEqual([])
    expect(result.current.filters.owner).toEqual([])
  })

  it('encaminha teamId e owner ao service quando preenchidos (070)', async () => {
    const { result } = renderHook(() => useClientTickets(1), { wrapper: wrapper() })

    result.current.setFilters({ teamId: [1, 2], owner: [7] })

    await waitFor(() => {
      expect(service.listClientTickets).toHaveBeenCalledWith(
        expect.objectContaining({ teamId: [1, 2], owner: [7] }),
      )
    })
  })
})
