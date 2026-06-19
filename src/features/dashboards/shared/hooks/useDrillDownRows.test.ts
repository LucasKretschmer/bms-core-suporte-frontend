/**
 * Testes de useDrillDownRows.
 * Verifica: enabled=false na init, ativação via enable(), paginação.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { useDrillDownRows } from './useDrillDownRows'
import * as metricsService from '../services/metricsService'
import type { PaginatedResponse } from '../../../../types/api'
import type { TimeEntryRowDto } from '../types/metrics'

const MOCK_ROW: TimeEntryRowDto = {
  timeEntryId: 'te-1',
  ticketId: 'ticket-1',
  hubspotTicketId: 'hs-101',
  assunto: 'Problema de acesso',
  atendente: 'Fulano',
  equipe: 'Suporte',
  totalSegundos: 3600,
  dataApontamento: '2026-06-10',
}

const MOCK_PAGE: PaginatedResponse<TimeEntryRowDto> = {
  items: [MOCK_ROW],
  totalCount: 1,
  page: 1,
  pageSize: 25,
  totalPages: 1,
}

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client }, children)
}

describe('useDrillDownRows', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('enabled=false na inicialização — queryFn não é chamado', () => {
    const spy = vi
      .spyOn(metricsService, 'getDrillDownRows')
      .mockResolvedValue(MOCK_PAGE)

    renderHook(
      () =>
        useDrillDownRows({
          scope: 'management:suporte',
          from: '2026-06-01',
          to: '2026-06-17',
        }),
      { wrapper: makeWrapper() },
    )

    expect(spy).not.toHaveBeenCalled()
  })

  it('após enable() — queryFn é chamado', async () => {
    const spy = vi
      .spyOn(metricsService, 'getDrillDownRows')
      .mockResolvedValue(MOCK_PAGE)

    const { result } = renderHook(
      () =>
        useDrillDownRows({
          scope: 'management:suporte',
          from: '2026-06-01',
          to: '2026-06-17',
        }),
      { wrapper: makeWrapper() },
    )

    act(() => {
      result.current.enable()
    })

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(spy).toHaveBeenCalled()
    expect(result.current.data?.items).toHaveLength(1)
  })

  it('disable() desativa a query e reseta para página 1', async () => {
    vi.spyOn(metricsService, 'getDrillDownRows').mockResolvedValue(MOCK_PAGE)

    const { result } = renderHook(
      () =>
        useDrillDownRows({
          scope: 'management:suporte',
          from: '2026-06-01',
          to: '2026-06-17',
        }),
      { wrapper: makeWrapper() },
    )

    act(() => {
      result.current.enable()
    })

    await waitFor(() => expect(result.current.isEnabled).toBe(true))

    act(() => {
      result.current.disable()
    })

    expect(result.current.isEnabled).toBe(false)
    expect(result.current.page).toBe(1)
  })

  it('setPage(2) → page muda para 2 e queryFn é chamado com page:2', async () => {
    const spy = vi
      .spyOn(metricsService, 'getDrillDownRows')
      .mockResolvedValue({ ...MOCK_PAGE, page: 2 })

    const { result } = renderHook(
      () =>
        useDrillDownRows({
          scope: 'management:suporte',
          from: '2026-06-01',
          to: '2026-06-17',
        }),
      { wrapper: makeWrapper() },
    )

    act(() => {
      result.current.enable()
    })

    act(() => {
      result.current.setPage(2)
    })

    await waitFor(() => {
      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({ page: 2 }),
      )
    })
    expect(result.current.page).toBe(2)
  })

  it('setPageSize reseta a página para 1', async () => {
    vi.spyOn(metricsService, 'getDrillDownRows').mockResolvedValue(MOCK_PAGE)

    const { result } = renderHook(
      () =>
        useDrillDownRows({
          scope: 'management:suporte',
          from: '2026-06-01',
          to: '2026-06-17',
        }),
      { wrapper: makeWrapper() },
    )

    act(() => {
      result.current.enable()
      result.current.setPage(3)
    })

    await waitFor(() => expect(result.current.page).toBe(3))

    act(() => {
      result.current.setPageSize(50)
    })

    expect(result.current.pageSize).toBe(50)
    expect(result.current.page).toBe(1)
  })

  it('setSort com campo novo → sortBy muda e sortDirection é desc', () => {
    vi.spyOn(metricsService, 'getDrillDownRows').mockResolvedValue(MOCK_PAGE)

    const { result } = renderHook(
      () =>
        useDrillDownRows({
          scope: 'management:suporte',
          from: null,
          to: null,
        }),
      { wrapper: makeWrapper() },
    )

    act(() => {
      result.current.setSort('atendente')
    })

    expect(result.current.sortBy).toBe('atendente')
    expect(result.current.sortDirection).toBe('desc')
  })

  it('setSort com mesmo campo → inverte sortDirection', () => {
    vi.spyOn(metricsService, 'getDrillDownRows').mockResolvedValue(MOCK_PAGE)

    const { result } = renderHook(
      () =>
        useDrillDownRows({
          scope: 'management:suporte',
          from: null,
          to: null,
        }),
      { wrapper: makeWrapper() },
    )

    act(() => result.current.setSort('atendente'))
    expect(result.current.sortDirection).toBe('desc')

    act(() => result.current.setSort('atendente'))
    expect(result.current.sortDirection).toBe('asc')
  })
})
