/**
 * Teste da tela Apontamentos por Ticket (index.tsx).
 *
 * Foco: largura do filtro de Status (067).
 * O campo Status deve ter `min-w-[216px]` (180px × 1.2) e o campo Equipes
 * deve permanecer em `min-w-[180px]` — garante que a alteração de largura
 * atingiu apenas o Status, sem regredir o de Equipes.
 *
 * As dependências pesadas (hook de dados, permissões, router, toast) são
 * mockadas. Mantemos isLoading=true para renderizar apenas a barra de filtros
 * (a DataTable não é montada nesse estado), tornando o teste leve e estável.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'

// ── Mocks de dependências ─────────────────────────────────────────────────────

vi.mock('./hooks/useAppointments', () => ({
  useAppointments: vi.fn(),
}))
vi.mock('../../../hooks/usePermissions', () => ({
  usePermissions: vi.fn(),
}))
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
}))
vi.mock('../../../components/ui/Toast', () => ({
  useToast: () => ({ info: vi.fn(), success: vi.fn(), error: vi.fn() }),
}))
// Service usado pelos useQuery internos (status/equipes) — retornam vazio.
vi.mock('../shared/services/reportsService', () => ({
  getTicketStatuses: vi.fn().mockResolvedValue([]),
  getTicketCategories: vi.fn().mockResolvedValue([]),
  listTeams: vi.fn().mockResolvedValue([]),
  listTicketsReport: vi.fn().mockResolvedValue({
    items: [],
    totalCount: 0,
    page: 1,
    pageSize: 25,
    totalPages: 0,
  }),
}))

import AppointmentsPage, { EXPORT_COLUMNS, mapToExportRow } from './index'
import { useAppointments } from './hooks/useAppointments'
import { usePermissions } from '../../../hooks/usePermissions'
import type { TicketReportItemDto } from '../shared/types/reports'

const mockedUseAppointments = vi.mocked(useAppointments)
const mockedUsePermissions = vi.mocked(usePermissions)

beforeEach(() => {
  vi.clearAllMocks()

  mockedUsePermissions.mockReturnValue({
    role: 'ATENDENTE',
    isCoordenadorOuAcima: false,
    isGerentePlus: false,
    isAtendente: true,
    isAuthenticated: true,
  })

  mockedUseAppointments.mockReturnValue({
    data: undefined,
    isLoading: true, // só a barra de filtros é renderizada
    isError: false,
    refetch: vi.fn(),
    sortBy: null,
    sortDirection: 'desc',
    filters: {
      scope: 'mine',
      search: '',
      status: [],
      teamId: [],
      categoria: [],
      from: null,
      to: null,
    },
    page: 1,
    pageSize: 25,
    setPage: vi.fn(),
    setPageSize: vi.fn(),
    setSort: vi.fn(),
    setFilters: vi.fn(),
  } as unknown as ReturnType<typeof useAppointments>)
})

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <AppointmentsPage />
    </QueryClientProvider>,
  )
}

describe('AppointmentsPage — largura dos filtros multi-select (067/071)', () => {
  it('o filtro de Status usa min-w-[281px] (216 × 1.3 — 071)', () => {
    renderPage()
    // O className do MultiSelectCombobox vai para o container que envolve o label.
    const statusLabel = screen.getByText('Status')
    const statusContainer = statusLabel.closest('div')
    expect(statusContainer).not.toBeNull()
    expect(statusContainer).toHaveClass('min-w-[281px]')
    expect(statusContainer).not.toHaveClass('min-w-[216px]')
    expect(statusContainer).not.toHaveClass('min-w-[180px]')
  })

  it('o filtro de Equipes permanece em min-w-[180px] (não regrediu)', () => {
    renderPage()
    const teamsLabel = screen.getByText('Equipes')
    const teamsContainer = teamsLabel.closest('div')
    expect(teamsContainer).not.toBeNull()
    expect(teamsContainer).toHaveClass('min-w-[180px]')
    expect(teamsContainer).not.toHaveClass('min-w-[216px]')
  })
})

describe('AppointmentsPage — filtro de Categoria (107)', () => {
  it('renderiza o filtro de Categoria na barra de filtros', () => {
    renderPage()
    expect(screen.getByText('Categoria')).toBeInTheDocument()
  })
})

describe('AppointmentsPage — export sem categoria (107, privacidade)', () => {
  it('EXPORT_COLUMNS não inclui a coluna categoria', () => {
    expect(EXPORT_COLUMNS.some((c) => c.key === 'categoria')).toBe(false)
  })

  it('mapToExportRow não expõe a categoria HubSpot na linha exportada', () => {
    const item: TicketReportItemDto = {
      ticketId: 1,
      hubspotTicketId: '1001',
      assunto: 'Erro',
      clienteNome: 'ACME',
      equipe: 'BR',
      ownerNome: 'Ana',
      status: 'Aberto',
      categoria: 'Problema - Invoicy',
      totalSeconds: 60,
      apontamentosCount: 1,
      hubspotUrl: null,
    }
    const row = mapToExportRow(item)
    expect(row).not.toHaveProperty('categoria')
    expect(Object.values(row)).not.toContain('Problema - Invoicy')
  })
})
