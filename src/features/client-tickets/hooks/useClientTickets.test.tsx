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

  it('inicia from/to nulos quando sem datas iniciais (095)', () => {
    const { result } = renderHook(() => useClientTickets(1), { wrapper: wrapper() })
    expect(result.current.filters.from).toBeNull()
    expect(result.current.filters.to).toBeNull()
  })

  it('semeia from/to a partir das datas iniciais e as encaminha ao service (095)', async () => {
    const { result } = renderHook(
      () => useClientTickets(1, { from: '2026-06-01', to: '2026-06-30' }),
      { wrapper: wrapper() },
    )
    expect(result.current.filters.from).toBe('2026-06-01')
    expect(result.current.filters.to).toBe('2026-06-30')

    await waitFor(() => {
      expect(service.listClientTickets).toHaveBeenCalledWith(
        expect.objectContaining({ from: '2026-06-01', to: '2026-06-30' }),
      )
    })
  })

  it('encaminha from/to ao service ao alterar o período (095)', async () => {
    const { result } = renderHook(() => useClientTickets(1), { wrapper: wrapper() })

    result.current.setFilters({ from: '2026-07-01', to: '2026-07-15' })

    await waitFor(() => {
      expect(service.listClientTickets).toHaveBeenCalledWith(
        expect.objectContaining({ from: '2026-07-01', to: '2026-07-15' }),
      )
    })
  })

  it('omite from/to (undefined) ao service quando o período está nulo (095)', async () => {
    renderHook(() => useClientTickets(1), { wrapper: wrapper() })
    await waitFor(() => {
      expect(service.listClientTickets).toHaveBeenCalled()
    })
    const lastCall = vi.mocked(service.listClientTickets).mock.calls.at(-1)?.[0]
    expect(lastCall?.from).toBeUndefined()
    expect(lastCall?.to).toBeUndefined()
  })
})
