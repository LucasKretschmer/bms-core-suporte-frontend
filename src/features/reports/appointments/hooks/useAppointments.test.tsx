/**
 * Testes para o hook useAppointments (U4 — Apontamentos por Ticket).
 *
 * Verifica:
 * - scope default por papel (#9): Coordenador+ → 'all'; Atendente → 'mine'
 * - status é array (filter de múltiplos valores)
 * - filtros são passados corretamente ao service
 * - ao mudar filtro, página volta para 1
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, act, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { format, startOfMonth } from 'date-fns'
import { useAppointments, defaultAppointmentsPeriod } from './useAppointments'
import { usePermissions } from '../../../../hooks/usePermissions'
import { listTicketsReport } from '../../shared/services/reportsService'
import type { PaginatedResponse } from '../../../../types/api'
import type { TicketReportItemDto } from '../../shared/types/reports'

// Mock do service para evitar chamadas HTTP reais
vi.mock('../../shared/services/reportsService', () => ({
  listTicketsReport: vi.fn().mockResolvedValue({
    items: [],
    totalCount: 0,
    page: 1,
    pageSize: 25,
    totalPages: 0,
  } satisfies PaginatedResponse<TicketReportItemDto>),
}))

// Mock de permissões — o scope default depende do papel.
vi.mock('../../../../hooks/usePermissions')
const mockedPermissions = vi.mocked(usePermissions)

function setRole(isCoordenadorOuAcima: boolean) {
  mockedPermissions.mockReturnValue({
    role: isCoordenadorOuAcima ? 'COORDENADOR' : 'ATENDENTE',
    isCoordenadorOuAcima,
    isGerentePlus: false,
    isAtendente: !isCoordenadorOuAcima,
    isAuthenticated: true,
  })
}

beforeEach(() => {
  // Default da maioria dos casos: Atendente (scope 'mine').
  setRole(false)
  // Isola cada teste: sem filtros persistidos remanescentes (075).
  sessionStorage.clear()
})

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe('useAppointments', () => {
  it('Atendente inicia com scope "mine"', () => {
    setRole(false)
    const { result } = renderHook(() => useAppointments(), {
      wrapper: createWrapper(),
    })
    expect(result.current.filters.scope).toBe('mine')
  })

  it('Coordenador+ inicia com scope "all" (#9)', () => {
    setRole(true)
    const { result } = renderHook(() => useAppointments(), {
      wrapper: createWrapper(),
    })
    expect(result.current.filters.scope).toBe('all')
  })

  it('status é um array vazio por padrão', () => {
    const { result } = renderHook(() => useAppointments(), {
      wrapper: createWrapper(),
    })
    expect(Array.isArray(result.current.filters.status)).toBe(true)
    expect(result.current.filters.status).toHaveLength(0)
  })

  it('permite alterar scope para "all" (para CoordenadorPlus)', () => {
    const { result } = renderHook(() => useAppointments(), {
      wrapper: createWrapper(),
    })

    act(() => {
      result.current.setFilters({ scope: 'all' })
    })

    expect(result.current.filters.scope).toBe('all')
  })

  it('aceita múltiplos status como array', () => {
    const { result } = renderHook(() => useAppointments(), {
      wrapper: createWrapper(),
    })

    act(() => {
      result.current.setFilters({ status: ['Aberto', 'Em andamento'] })
    })

    expect(result.current.filters.status).toEqual(['Aberto', 'Em andamento'])
  })

  it('ao mudar filtro de status, reseta para página 1', () => {
    const { result } = renderHook(() => useAppointments(), {
      wrapper: createWrapper(),
    })

    act(() => result.current.setPage(3))
    expect(result.current.page).toBe(3)

    act(() => result.current.setFilters({ status: ['Fechado'] }))
    expect(result.current.page).toBe(1)
  })

  it('ao mudar search, reseta para página 1', () => {
    const { result } = renderHook(() => useAppointments(), {
      wrapper: createWrapper(),
    })

    act(() => result.current.setPage(5))
    act(() => result.current.setFilters({ search: 'teste' }))
    expect(result.current.page).toBe(1)
    expect(result.current.filters.search).toBe('teste')
  })

  it('inicia com sortDirection "desc"', () => {
    const { result } = renderHook(() => useAppointments(), {
      wrapper: createWrapper(),
    })
    expect(result.current.sortDirection).toBe('desc')
  })

  it('período default = mês atual: from = 1º dia do mês, to = hoje', () => {
    const today = new Date()
    const expectedFrom = format(startOfMonth(today), 'yyyy-MM-dd')
    const expectedTo = format(today, 'yyyy-MM-dd')

    const { result } = renderHook(() => useAppointments(), {
      wrapper: createWrapper(),
    })
    expect(result.current.filters.from).toBe(expectedFrom)
    expect(result.current.filters.to).toBe(expectedTo)
  })

  it('período é clearable (usuário pode limpar from/to para null)', () => {
    const { result } = renderHook(() => useAppointments(), {
      wrapper: createWrapper(),
    })

    act(() => result.current.setFilters({ from: null, to: null }))
    expect(result.current.filters.from).toBeNull()
    expect(result.current.filters.to).toBeNull()
  })

  it('teamId inicia como array vazio e aceita múltiplos IDs', () => {
    const { result } = renderHook(() => useAppointments(), {
      wrapper: createWrapper(),
    })
    expect(result.current.filters.teamId).toEqual([])

    act(() => result.current.setFilters({ teamId: [1, 2] }))
    expect(result.current.filters.teamId).toEqual([1, 2])
  })

  it('ao mudar filtro de equipe, reseta para página 1', () => {
    const { result } = renderHook(() => useAppointments(), {
      wrapper: createWrapper(),
    })

    act(() => result.current.setPage(4))
    act(() => result.current.setFilters({ teamId: [3] }))
    expect(result.current.page).toBe(1)
  })

  // ── Filtro de categoria (107) ────────────────────────────────────────────────

  it('categoria inicia como array vazio e aceita múltiplos valores', () => {
    const { result } = renderHook(() => useAppointments(), {
      wrapper: createWrapper(),
    })
    expect(result.current.filters.categoria).toEqual([])

    act(() => result.current.setFilters({ categoria: ['Problema - Invoicy', 'Dúvida'] }))
    expect(result.current.filters.categoria).toEqual(['Problema - Invoicy', 'Dúvida'])
  })

  it('ao mudar filtro de categoria, reseta para página 1', () => {
    const { result } = renderHook(() => useAppointments(), {
      wrapper: createWrapper(),
    })

    act(() => result.current.setPage(2))
    act(() => result.current.setFilters({ categoria: ['Problema - Invoicy'] }))
    expect(result.current.page).toBe(1)
  })

  it('envia categoria[] ao service quando há categorias selecionadas', async () => {
    const mocked = vi.mocked(listTicketsReport)
    mocked.mockClear()

    const { result } = renderHook(() => useAppointments(), {
      wrapper: createWrapper(),
    })

    act(() => result.current.setFilters({ categoria: ['Problema - Invoicy'] }))

    await waitFor(() => {
      expect(mocked).toHaveBeenCalledWith(
        expect.objectContaining({ categoria: ['Problema - Invoicy'] }),
      )
    })
  })

  it('não envia categoria ao service quando o filtro está vazio (undefined)', async () => {
    const mocked = vi.mocked(listTicketsReport)
    mocked.mockClear()

    renderHook(() => useAppointments(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(mocked).toHaveBeenCalled())
    const firstArg = mocked.mock.calls[0][0]
    expect(firstArg.categoria).toBeUndefined()
  })
})

describe('useAppointments — preservação de filtros ao voltar do detalhe (075)', () => {
  const STORAGE_KEY = 'report-filters:appointments'

  it('reidrata filtros salvos em sessionStorage (status/teamId/from/to/scope/search)', () => {
    setRole(true) // Coordenador+: pode ter escolhido scope 'team'
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        scope: 'team',
        search: 'nfe',
        status: ['Aberto', 'Fechado'],
        teamId: [7, 9],
        from: '2026-03-01',
        to: '2026-03-31',
        sortBy: 'totalSeconds',
        sortDirection: 'asc',
      }),
    )

    const { result } = renderHook(() => useAppointments(), {
      wrapper: createWrapper(),
    })

    expect(result.current.filters.scope).toBe('team')
    expect(result.current.filters.search).toBe('nfe')
    expect(result.current.filters.status).toEqual(['Aberto', 'Fechado'])
    expect(result.current.filters.teamId).toEqual([7, 9])
    expect(result.current.filters.from).toBe('2026-03-01')
    expect(result.current.filters.to).toBe('2026-03-31')
  })

  it('reidrata a ordenação salva (sortBy/sortDirection)', () => {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ sortBy: 'totalSeconds', sortDirection: 'asc' }),
    )

    const { result } = renderHook(() => useAppointments(), {
      wrapper: createWrapper(),
    })

    expect(result.current.sortBy).toBe('totalSeconds')
    expect(result.current.sortDirection).toBe('asc')
  })

  it('sem nada salvo, usa os defaults (período mês atual, scope por papel, sort desc)', () => {
    const today = new Date()
    const expectedFrom = format(startOfMonth(today), 'yyyy-MM-dd')
    const expectedTo = format(today, 'yyyy-MM-dd')

    const { result } = renderHook(() => useAppointments(), {
      wrapper: createWrapper(),
    })

    expect(result.current.filters.scope).toBe('mine')
    expect(result.current.filters.search).toBe('')
    expect(result.current.filters.status).toEqual([])
    expect(result.current.filters.teamId).toEqual([])
    expect(result.current.filters.from).toBe(expectedFrom)
    expect(result.current.filters.to).toBe(expectedTo)
    expect(result.current.sortBy).toBeNull()
    expect(result.current.sortDirection).toBe('desc')
  })

  it('blob parcial: campos ausentes caem nos defaults, presentes são restaurados', () => {
    // Só status salvo — restante deve vir dos defaults.
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ status: ['Em andamento'] }))

    const today = new Date()
    const expectedFrom = format(startOfMonth(today), 'yyyy-MM-dd')

    const { result } = renderHook(() => useAppointments(), {
      wrapper: createWrapper(),
    })

    expect(result.current.filters.status).toEqual(['Em andamento'])
    expect(result.current.filters.scope).toBe('mine')
    expect(result.current.filters.from).toBe(expectedFrom)
    expect(result.current.sortBy).toBeNull()
  })

  it('preserva período limpo intencionalmente (from/to = null salvos)', () => {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ from: null, to: null, status: ['Aberto'] }),
    )

    const { result } = renderHook(() => useAppointments(), {
      wrapper: createWrapper(),
    })

    expect(result.current.filters.from).toBeNull()
    expect(result.current.filters.to).toBeNull()
    expect(result.current.filters.status).toEqual(['Aberto'])
  })

  it('blob inválido (JSON corrompido) cai nos defaults sem quebrar', () => {
    sessionStorage.setItem(STORAGE_KEY, '{corrompido')

    const today = new Date()
    const expectedFrom = format(startOfMonth(today), 'yyyy-MM-dd')

    const { result } = renderHook(() => useAppointments(), {
      wrapper: createWrapper(),
    })

    expect(result.current.filters.from).toBe(expectedFrom)
    expect(result.current.filters.scope).toBe('mine')
    expect(result.current.sortDirection).toBe('desc')
  })
})

describe('defaultAppointmentsPeriod', () => {
  it('retorna 1º dia do mês como from e a data de referência como to', () => {
    const ref = new Date(2026, 5, 30) // 30/06/2026
    const period = defaultAppointmentsPeriod(ref)
    expect(period.from).toBe('2026-06-01')
    expect(period.to).toBe('2026-06-30')
  })
})
